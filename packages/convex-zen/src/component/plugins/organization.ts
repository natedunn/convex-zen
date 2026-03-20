import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  type DatabaseReader,
  type DatabaseWriter,
} from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { generateToken, hashToken } from "../lib/crypto";

const OWNER_ROLE = "owner";
const ADMIN_ROLE = "admin";
const MEMBER_ROLE = "member";
const SYSTEM_ROLE_TYPE = "system";
const CUSTOM_ROLE_TYPE = "custom";
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  owner: [
    "organization:read",
    "organization:update",
    "organization:delete",
    "organization:transfer",
    "accessControl:read",
    "role:read",
    "role:create",
    "role:update",
    "role:delete",
    "member:read",
    "member:create",
    "member:update",
    "member:delete",
    "invitation:read",
    "invitation:create",
    "invitation:cancel",
    "invitation:accept",
    "domain:read",
    "domain:create",
    "domain:verify",
    "domain:delete",
  ],
  admin: [
    "organization:read",
    "organization:update",
    "accessControl:read",
    "role:read",
    "role:create",
    "role:update",
    "member:read",
    "member:create",
    "member:update",
    "member:delete",
    "invitation:read",
    "invitation:create",
    "invitation:cancel",
    "domain:read",
    "domain:create",
  ],
  member: [
    "organization:read",
    "member:read",
  ],
};

type OrganizationPermission = {
  resource: string;
  action: string;
};
type AccessControlMap = Record<string, string[]>;
type RolePermissions = Record<string, string[]>;
type OrganizationRecord = {
  _id: Id<"organizations">;
  name: string;
  slug: string;
  logo?: string;
  createdByUserId: Id<"users">;
  createdAt: number;
  updatedAt: number;
};
type OrganizationMemberRecord = {
  _id: Id<"organizationMembers">;
  organizationId: Id<"organizations">;
  userId: Id<"users">;
  roleType: string;
  systemRole?: string;
  customRoleId?: Id<"organizationRoles">;
  createdAt: number;
  updatedAt: number;
};
type OrganizationRoleRecord = {
  _id: Id<"organizationRoles">;
  organizationId: Id<"organizations">;
  name: string;
  slug: string;
  description?: string;
  permissions: string[];
  createdByUserId: Id<"users">;
  createdAt: number;
  updatedAt: number;
};
type OrganizationInvitationRecord = {
  _id: Id<"organizationInvitations">;
  organizationId: Id<"organizations">;
  email: string;
  roleType: string;
  systemRole?: string;
  customRoleId?: Id<"organizationRoles">;
  invitedByUserId: Id<"users">;
  tokenHash: string;
  expiresAt: number;
  acceptedAt?: number;
  cancelledAt?: number;
  declinedAt?: number;
  createdAt: number;
  updatedAt: number;
};
type OrganizationDomainRecord = {
  _id: Id<"organizationDomains">;
  organizationId: Id<"organizations">;
  hostname: string;
  verificationToken: string;
  verifiedAt?: number;
  createdAt: number;
  updatedAt: number;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizeSlug(slug: string): string {
  const normalized = slug.trim().toLowerCase();
  if (normalized.length < 3 || normalized.length > 63) {
    throw new Error("Organization slug must be between 3 and 63 characters");
  }
  if (!SLUG_PATTERN.test(normalized)) {
    throw new Error(
      "Organization slug must contain only lowercase letters, numbers, and single hyphens"
    );
  }
  return normalized;
}

function normalizeRoleSlug(slug: string): string {
  const normalized = normalizeSlug(slug);
  if (
    normalized === OWNER_ROLE ||
    normalized === ADMIN_ROLE ||
    normalized === MEMBER_ROLE
  ) {
    throw new Error("Reserved organization role names cannot be reused");
  }
  return normalized;
}

function normalizeHostname(hostname: string): string {
  const trimmed = hostname.trim().toLowerCase().replace(/\.$/, "");
  const withoutPort = trimmed.replace(/:\d+$/, "");
  if (withoutPort.length === 0) {
    throw new Error("Hostname is required");
  }
  if (withoutPort.includes("*")) {
    throw new Error("Wildcard hostnames are not supported");
  }
  if (!withoutPort.includes(".")) {
    throw new Error("Hostname must include a domain");
  }
  return withoutPort;
}

function permissionToken(permission: OrganizationPermission): string {
  return `${permission.resource}:${permission.action}`;
}

function permissionTokenFromParts(resource: string, action: string): string {
  return `${resource}:${action}`;
}

function resolveRolePermissions(rolePermissions?: RolePermissions): RolePermissions {
  return rolePermissions ?? DEFAULT_ROLE_PERMISSIONS;
}

function hasRolePermission(
  rolePermissions: RolePermissions | undefined,
  role: string,
  permission: OrganizationPermission
): boolean {
  const granted = resolveRolePermissions(rolePermissions)[role] ?? [];
  return granted.includes(permissionToken(permission));
}

function resolveMembershipRoleName(
  membership: Pick<OrganizationMemberRecord, "roleType" | "systemRole">,
  customRoleName?: string
): string {
  if (membership.roleType === SYSTEM_ROLE_TYPE) {
    return membership.systemRole ?? MEMBER_ROLE;
  }
  if (!customRoleName) {
    throw new Error("Custom organization role is missing");
  }
  return customRoleName;
}

function sanitizeMembership(
  membership: OrganizationMemberRecord,
  customRoleName?: string
) {
  return {
    _id: membership._id,
    organizationId: membership.organizationId,
    userId: membership.userId,
    roleType:
      membership.roleType === CUSTOM_ROLE_TYPE ? CUSTOM_ROLE_TYPE : SYSTEM_ROLE_TYPE,
    roleName: resolveMembershipRoleName(membership, customRoleName),
    systemRole:
      membership.roleType === SYSTEM_ROLE_TYPE ? membership.systemRole : undefined,
    customRoleId:
      membership.roleType === CUSTOM_ROLE_TYPE ? membership.customRoleId : undefined,
    createdAt: membership.createdAt,
    updatedAt: membership.updatedAt,
    _creationTime: (membership as { _creationTime?: number })._creationTime,
  };
}

function isInvitationPending(
  invitation: OrganizationInvitationRecord,
  now: number
): boolean {
  return (
    invitation.acceptedAt === undefined &&
    invitation.cancelledAt === undefined &&
    invitation.declinedAt === undefined &&
    invitation.expiresAt > now
  );
}

function sanitizeInvitation(
  invitation: OrganizationInvitationRecord,
  customRoleName?: string
) {
  return {
    _id: invitation._id,
    organizationId: invitation.organizationId,
    email: invitation.email,
    roleType:
      invitation.roleType === CUSTOM_ROLE_TYPE ? CUSTOM_ROLE_TYPE : SYSTEM_ROLE_TYPE,
    roleName:
      invitation.roleType === SYSTEM_ROLE_TYPE
        ? invitation.systemRole ?? MEMBER_ROLE
        : customRoleName ?? "custom-role",
    systemRole:
      invitation.roleType === SYSTEM_ROLE_TYPE ? invitation.systemRole : undefined,
    customRoleId:
      invitation.roleType === CUSTOM_ROLE_TYPE ? invitation.customRoleId : undefined,
    invitedByUserId: invitation.invitedByUserId,
    expiresAt: invitation.expiresAt,
    acceptedAt: invitation.acceptedAt,
    cancelledAt: invitation.cancelledAt,
    declinedAt: invitation.declinedAt,
    createdAt: invitation.createdAt,
    updatedAt: invitation.updatedAt,
    _creationTime: (invitation as { _creationTime?: number })._creationTime,
  };
}

function sanitizeDomain(domain: OrganizationDomainRecord) {
  return {
    _id: domain._id,
    organizationId: domain.organizationId,
    hostname: domain.hostname,
    verifiedAt: domain.verifiedAt,
    createdAt: domain.createdAt,
    updatedAt: domain.updatedAt,
    _creationTime: (domain as { _creationTime?: number })._creationTime,
  };
}

function sanitizeRole(role: OrganizationRoleRecord) {
  return {
    _id: role._id,
    organizationId: role.organizationId,
    name: role.name,
    slug: role.slug,
    description: role.description,
    permissions: [...role.permissions],
    createdByUserId: role.createdByUserId,
    createdAt: role.createdAt,
    updatedAt: role.updatedAt,
    _creationTime: (role as { _creationTime?: number })._creationTime,
  };
}

function isOwnerMembership(membership: OrganizationMemberRecord): boolean {
  return (
    membership.roleType === SYSTEM_ROLE_TYPE && membership.systemRole === OWNER_ROLE
  );
}

function normalizePermissionList(
  permissions: readonly string[],
  accessControl?: AccessControlMap
): string[] {
  const normalized = [...new Set(permissions.map((permission) => permission.trim()))]
    .filter((permission) => permission.length > 0)
    .sort();
  if (!accessControl) {
    return normalized;
  }
  const allowed = new Set<string>();
  for (const [resource, actions] of Object.entries(accessControl)) {
    for (const action of actions) {
      allowed.add(permissionTokenFromParts(resource, action));
    }
  }
  for (const permission of normalized) {
    if (!allowed.has(permission)) {
      throw new Error(`Unknown organization permission: ${permission}`);
    }
  }
  return normalized;
}

function serializeAvailablePermissions(accessControl?: AccessControlMap) {
  const resources = Object.fromEntries(
    Object.entries(accessControl ?? {})
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([resource, actions]) => [resource, [...actions].sort()])
  );
  const permissions = Object.entries(resources)
    .flatMap(([resource, actions]) =>
      actions.map((action) => permissionTokenFromParts(resource, action))
    )
    .sort();
  return {
    resources,
    permissions,
  };
}

async function requireUser(
  db: DatabaseReader,
  userId: Id<"users">
): Promise<void> {
  const user = await db.get(userId);
  if (user === null) {
    throw new Error("Unauthorized");
  }
}

async function resolveActorEmailFromDb(
  db: DatabaseReader,
  actorUserId: Id<"users">
): Promise<string> {
  const user = await db.get(actorUserId);
  if (!user || !user.email) {
    throw new Error("Unauthorized");
  }
  return user.email;
}

async function getOrganizationBySlug(
  db: DatabaseReader,
  slug: string
): Promise<OrganizationRecord | null> {
  return await db
    .query("organizations")
    .withIndex("by_slug", (q) => q.eq("slug", slug))
    .unique();
}

async function getOrganizationMembership(
  db: DatabaseReader,
  organizationId: Id<"organizations">,
  userId: Id<"users">
): Promise<OrganizationMemberRecord | null> {
  return await db
    .query("organizationMembers")
    .withIndex("by_organizationId_userId", (q) =>
      q.eq("organizationId", organizationId).eq("userId", userId)
    )
    .unique();
}

async function getOrganizationRole(
  db: DatabaseReader,
  roleId: Id<"organizationRoles">
): Promise<OrganizationRoleRecord | null> {
  return await db.get(roleId);
}

async function getOrganizationRoleBySlug(
  db: DatabaseReader,
  organizationId: Id<"organizations">,
  slug: string
): Promise<OrganizationRoleRecord | null> {
  return await db
    .query("organizationRoles")
    .withIndex("by_organizationId_slug", (q) =>
      q.eq("organizationId", organizationId).eq("slug", slug)
    )
    .unique();
}

async function requireOrganizationRoleRecord(
  db: DatabaseReader,
  roleId: Id<"organizationRoles">
): Promise<OrganizationRoleRecord> {
  const role = await getOrganizationRole(db, roleId);
  if (!role) {
    throw new Error("Organization role not found");
  }
  return role;
}

async function requireOrganization(
  db: DatabaseReader,
  organizationId: Id<"organizations">
): Promise<OrganizationRecord> {
  const organization = await db.get(organizationId);
  if (!organization) {
    throw new Error("Organization not found");
  }
  return organization;
}

async function requireMembership(
  db: DatabaseReader,
  organizationId: Id<"organizations">,
  userId: Id<"users">
): Promise<OrganizationMemberRecord> {
  const membership = await getOrganizationMembership(db, organizationId, userId);
  if (!membership) {
    throw new Error("Forbidden");
  }
  return membership;
}

async function resolveGrantedPermissionsForMembership(
  db: DatabaseReader,
  membership: OrganizationMemberRecord,
  rolePermissions?: RolePermissions
): Promise<string[]> {
  if (membership.roleType === SYSTEM_ROLE_TYPE) {
    const systemRole = membership.systemRole ?? MEMBER_ROLE;
    return resolveRolePermissions(rolePermissions)[systemRole] ?? [];
  }
  if (!membership.customRoleId) {
    throw new Error("Custom organization role is missing");
  }
  const role = await requireOrganizationRoleRecord(db, membership.customRoleId);
  return role.permissions;
}

async function resolveMembershipRoleLabel(
  db: DatabaseReader,
  membership: OrganizationMemberRecord
): Promise<string> {
  if (membership.roleType === SYSTEM_ROLE_TYPE) {
    return membership.systemRole ?? MEMBER_ROLE;
  }
  if (!membership.customRoleId) {
    throw new Error("Custom organization role is missing");
  }
  const role = await requireOrganizationRoleRecord(db, membership.customRoleId);
  return role.slug;
}

async function resolveInvitationRoleLabel(
  db: DatabaseReader,
  invitation: OrganizationInvitationRecord
): Promise<string> {
  if (invitation.roleType === SYSTEM_ROLE_TYPE) {
    return invitation.systemRole ?? MEMBER_ROLE;
  }
  if (!invitation.customRoleId) {
    throw new Error("Custom organization role is missing");
  }
  const role = await requireOrganizationRoleRecord(db, invitation.customRoleId);
  return role.slug;
}

async function requirePermissionForOrganization(
  db: DatabaseReader,
  args: {
    organizationId: Id<"organizations">;
    actorUserId: Id<"users">;
    permission: OrganizationPermission;
    rolePermissions?: RolePermissions;
  }
): Promise<OrganizationMemberRecord> {
  const membership = await requireMembership(
    db,
    args.organizationId,
    args.actorUserId
  );
  const grantedPermissions = await resolveGrantedPermissionsForMembership(
    db,
    membership,
    args.rolePermissions
  );
  if (!grantedPermissions.includes(permissionToken(args.permission))) {
    throw new Error("Forbidden");
  }
  return membership;
}

async function listOrganizationMembersForOrg(
  db: DatabaseReader,
  organizationId: Id<"organizations">
): Promise<OrganizationMemberRecord[]> {
  return await db
    .query("organizationMembers")
    .withIndex("by_organizationId", (q) => q.eq("organizationId", organizationId))
    .collect();
}

async function deleteOrganizationCascade(
  db: DatabaseWriter,
  organizationId: Id<"organizations">
): Promise<void> {
  const members = await db
    .query("organizationMembers")
    .withIndex("by_organizationId", (q) => q.eq("organizationId", organizationId))
    .collect();
  for (const member of members) {
    await db.delete(member._id);
  }

  const invitations = await db
    .query("organizationInvitations")
    .withIndex("by_organizationId", (q) => q.eq("organizationId", organizationId))
    .collect();
  for (const invitation of invitations) {
    await db.delete(invitation._id);
  }

  const domains = await db
    .query("organizationDomains")
    .withIndex("by_organizationId", (q) => q.eq("organizationId", organizationId))
    .collect();
  for (const domain of domains) {
    await db.delete(domain._id);
  }

  const roles = await db
    .query("organizationRoles")
    .withIndex("by_organizationId", (q) => q.eq("organizationId", organizationId))
    .collect();
  for (const role of roles) {
    await db.delete(role._id);
  }

  await db.delete(organizationId);
}

export async function checkOrganizationSlugAvailability(
  db: DatabaseReader,
  slug: string
): Promise<{ slug: string; available: boolean }> {
  const normalizedSlug = normalizeSlug(slug);
  const existing = await getOrganizationBySlug(db, normalizedSlug);
  return {
    slug: normalizedSlug,
    available: existing === null,
  };
}

export async function createOrganizationForUser(
  db: DatabaseWriter,
  args: {
    actorUserId: Id<"users">;
    allowUserOrganizationCreation?: boolean;
    name: string;
    slug: string;
    logo?: string;
  }
): Promise<{
  organization: OrganizationRecord;
  membership: ReturnType<typeof sanitizeMembership>;
}> {
  await requireUser(db, args.actorUserId);
  if (args.allowUserOrganizationCreation === false) {
    throw new Error("Organization creation is disabled");
  }
  const normalizedSlug = normalizeSlug(args.slug);
  const existing = await getOrganizationBySlug(db, normalizedSlug);
  if (existing) {
    throw new Error("Organization slug is already in use");
  }

  const now = Date.now();
  const organizationId = await db.insert("organizations", {
    name: args.name.trim(),
    slug: normalizedSlug,
    logo: args.logo,
    createdByUserId: args.actorUserId,
    createdAt: now,
    updatedAt: now,
  });
  await db.insert("organizationMembers", {
    organizationId,
    userId: args.actorUserId,
    roleType: SYSTEM_ROLE_TYPE,
    systemRole: OWNER_ROLE,
    createdAt: now,
    updatedAt: now,
  });
  const organization = await requireOrganization(db, organizationId);
  const membership = await getOrganizationMembership(db, organizationId, args.actorUserId);
  if (!membership) {
    throw new Error("Failed to create organization membership");
  }
  return {
    organization,
    membership: sanitizeMembership(membership, OWNER_ROLE),
  };
}

export async function updateOrganizationByMember(
  db: DatabaseWriter,
  args: {
    actorUserId: Id<"users">;
    organizationId: Id<"organizations">;
    rolePermissions?: RolePermissions;
    name?: string;
    slug?: string;
    logo?: string;
  }
): Promise<OrganizationRecord> {
  await requirePermissionForOrganization(db, {
    organizationId: args.organizationId,
    actorUserId: args.actorUserId,
    permission: { resource: "organization", action: "update" },
    rolePermissions: args.rolePermissions,
  });
  const organization = await requireOrganization(db, args.organizationId);
  const patch: {
    name?: string;
    slug?: string;
    logo?: string;
    updatedAt: number;
  } = {
    updatedAt: Date.now(),
  };

  if (args.name !== undefined) {
    patch.name = args.name.trim();
  }
  if (args.slug !== undefined) {
    const normalizedSlug = normalizeSlug(args.slug);
    const existing = await getOrganizationBySlug(db, normalizedSlug);
    if (existing && existing._id !== organization._id) {
      throw new Error("Organization slug is already in use");
    }
    patch.slug = normalizedSlug;
  }
  if (args.logo !== undefined) {
    patch.logo = args.logo;
  }

  await db.patch(args.organizationId, patch);
  return (await requireOrganization(db, args.organizationId)) as OrganizationRecord;
}

export async function deleteOrganizationByMember(
  db: DatabaseWriter,
  args: {
    actorUserId: Id<"users">;
    organizationId: Id<"organizations">;
    rolePermissions?: RolePermissions;
  }
): Promise<void> {
  await requirePermissionForOrganization(db, {
    organizationId: args.organizationId,
    actorUserId: args.actorUserId,
    permission: { resource: "organization", action: "delete" },
    rolePermissions: args.rolePermissions,
  });
  await deleteOrganizationCascade(db, args.organizationId);
}

export async function listOrganizationsForUser(
  db: DatabaseReader,
  actorUserId: Id<"users">
): Promise<{
  organizations: Array<{
    organization: OrganizationRecord;
    membership: ReturnType<typeof sanitizeMembership>;
  }>;
}> {
  await requireUser(db, actorUserId);
  const memberships = await db
    .query("organizationMembers")
    .withIndex("by_userId", (q) => q.eq("userId", actorUserId))
    .collect();
  const organizations: Array<{
    organization: OrganizationRecord;
    membership: ReturnType<typeof sanitizeMembership>;
  }> = [];
  for (const membership of memberships) {
    const organization = await db.get(membership.organizationId);
    if (!organization) {
      continue;
    }
    const roleName = await resolveMembershipRoleLabel(db, membership);
    organizations.push({
      organization,
      membership: sanitizeMembership(membership, roleName),
    });
  }
  return { organizations };
}

export async function getOrganizationById(
  db: DatabaseReader,
  args: {
    actorUserId: Id<"users">;
    organizationId: Id<"organizations">;
    rolePermissions?: RolePermissions;
  }
): Promise<OrganizationRecord | null> {
  await requirePermissionForOrganization(db, {
    organizationId: args.organizationId,
    actorUserId: args.actorUserId,
    permission: { resource: "organization", action: "read" },
    rolePermissions: args.rolePermissions,
  });
  return await db.get(args.organizationId);
}

export async function getOrganizationMembershipForActor(
  db: DatabaseReader,
  args: {
    actorUserId: Id<"users">;
    organizationId: Id<"organizations">;
  }
): Promise<OrganizationMemberRecord | null> {
  await requireUser(db, args.actorUserId);
  const membership = await getOrganizationMembership(
    db,
    args.organizationId,
    args.actorUserId
  );
  if (!membership) {
    return null;
  }
  const roleName = await resolveMembershipRoleLabel(db, membership);
  return sanitizeMembership(membership, roleName) as unknown as OrganizationMemberRecord;
}

export async function listOrganizationMembersByActor(
  db: DatabaseReader,
  args: {
    actorUserId: Id<"users">;
    organizationId: Id<"organizations">;
    rolePermissions?: RolePermissions;
  }
): Promise<
  Array<
    OrganizationMemberRecord & {
      user: {
        _id: Id<"users">;
        email: string;
        emailVerified: boolean;
        name?: string;
        image?: string;
      };
    }
  >
> {
  await requirePermissionForOrganization(db, {
    organizationId: args.organizationId,
    actorUserId: args.actorUserId,
    permission: { resource: "member", action: "read" },
    rolePermissions: args.rolePermissions,
  });
  const members = await listOrganizationMembersForOrg(db, args.organizationId);
  const result = [];
  for (const member of members) {
    const user = await db.get(member.userId);
    if (!user) {
      continue;
    }
    const roleName = await resolveMembershipRoleLabel(db, member);
    result.push({
      ...sanitizeMembership(member, roleName),
      user: {
        _id: user._id,
        email: user.email,
        emailVerified: user.emailVerified,
        name: user.name,
        image: user.image,
      },
    });
  }
  return result;
}

export async function inviteOrganizationMember(
  db: DatabaseWriter,
  args: {
    actorUserId: Id<"users">;
    organizationId: Id<"organizations">;
    email: string;
    role: {
      type: "system" | "custom";
      systemRole?: string;
      customRoleId?: Id<"organizationRoles">;
    };
    accessControl?: Record<string, string[]>;
    inviteExpiresInMs?: number;
    rolePermissions?: RolePermissions;
  }
): Promise<{
  invitation: ReturnType<typeof sanitizeInvitation>;
  token: string;
}> {
  await requirePermissionForOrganization(db, {
    organizationId: args.organizationId,
    actorUserId: args.actorUserId,
    permission: { resource: "invitation", action: "create" },
    rolePermissions: args.rolePermissions,
  });
  if (args.role.type === SYSTEM_ROLE_TYPE && args.role.systemRole === OWNER_ROLE) {
    throw new Error("Use transferOwnership to assign organization ownership");
  }
  if (args.role.type === CUSTOM_ROLE_TYPE) {
    if (!args.role.customRoleId) {
      throw new Error("Custom organization role is required");
    }
    const customRole = await requireOrganizationRoleRecord(db, args.role.customRoleId);
    if (customRole.organizationId !== args.organizationId) {
      throw new Error("Organization role does not belong to this organization");
    }
  }

  const normalizedEmail = normalizeEmail(args.email);
  const existingMembers = await db
    .query("organizationMembers")
    .withIndex("by_organizationId", (q) => q.eq("organizationId", args.organizationId))
    .collect();
  for (const member of existingMembers) {
    const user = await db.get(member.userId);
    if (user?.email === normalizedEmail) {
      throw new Error("User is already a member of this organization");
    }
  }

  const now = Date.now();
  const invitations = await db
    .query("organizationInvitations")
    .withIndex("by_organizationId_email", (q) =>
      q.eq("organizationId", args.organizationId).eq("email", normalizedEmail)
    )
    .collect();
  for (const invitation of invitations) {
    if (isInvitationPending(invitation, now)) {
      throw new Error("A pending invitation already exists for this email");
    }
  }

  const token = generateToken();
  const tokenHash = await hashToken(token);
  const expiresAt =
    now + Math.max(args.inviteExpiresInMs ?? 7 * 24 * 60 * 60 * 1000, 1);
  const invitationId = await db.insert("organizationInvitations", {
    organizationId: args.organizationId,
    email: normalizedEmail,
    roleType: args.role.type,
    systemRole:
      args.role.type === SYSTEM_ROLE_TYPE ? args.role.systemRole : undefined,
    customRoleId:
      args.role.type === CUSTOM_ROLE_TYPE ? args.role.customRoleId : undefined,
    invitedByUserId: args.actorUserId,
    tokenHash,
    expiresAt,
    createdAt: now,
    updatedAt: now,
  });
  const invitation = await db.get(invitationId);
  if (!invitation) {
    throw new Error("Failed to create invitation");
  }
  const roleName = await resolveInvitationRoleLabel(db, invitation);
  return {
    invitation: sanitizeInvitation(invitation, roleName),
    token,
  };
}

export async function listOrganizationInvitationsByActor(
  db: DatabaseReader,
  args: {
    actorUserId: Id<"users">;
    organizationId: Id<"organizations">;
    rolePermissions?: RolePermissions;
  }
): Promise<Array<ReturnType<typeof sanitizeInvitation>>> {
  await requirePermissionForOrganization(db, {
    organizationId: args.organizationId,
    actorUserId: args.actorUserId,
    permission: { resource: "invitation", action: "read" },
    rolePermissions: args.rolePermissions,
  });
  const invitations = await db
    .query("organizationInvitations")
    .withIndex("by_organizationId", (q) => q.eq("organizationId", args.organizationId))
    .collect();
  const sanitized = [];
  for (const invitation of invitations) {
    const roleName = await resolveInvitationRoleLabel(db, invitation);
    sanitized.push(sanitizeInvitation(invitation, roleName));
  }
  return sanitized;
}

export async function listIncomingOrganizationInvitationsForUser(
  db: DatabaseReader,
  args: {
    actorUserId: Id<"users">;
  }
): Promise<
  Array<
    ReturnType<typeof sanitizeInvitation> & {
      organization: OrganizationRecord;
    }
  >
> {
  const actorEmail = await resolveActorEmailFromDb(db, args.actorUserId);
  const now = Date.now();
  const invitations = await db
    .query("organizationInvitations")
    .withIndex("by_email", (q) => q.eq("email", normalizeEmail(actorEmail)))
    .collect();
  const incoming = [];
  for (const invitation of invitations) {
    if (!isInvitationPending(invitation, now)) {
      continue;
    }
    const organization = await db.get(invitation.organizationId);
    if (!organization) {
      continue;
    }
    const roleName = await resolveInvitationRoleLabel(db, invitation);
    incoming.push({
      ...sanitizeInvitation(invitation, roleName),
      organization,
    });
  }
  incoming.sort((a, b) => a.expiresAt - b.expiresAt);
  return incoming;
}

async function getIncomingInvitationForActor(
  db: DatabaseReader,
  args: {
    actorUserId: Id<"users">;
    invitationId: Id<"organizationInvitations">;
  }
): Promise<{
  invitation: OrganizationInvitationRecord;
}> {
  const actorEmail = await resolveActorEmailFromDb(db, args.actorUserId);
  const invitation = await db.get(args.invitationId);
  if (!invitation) {
    throw new Error("Invitation not found");
  }
  if (normalizeEmail(actorEmail) !== invitation.email) {
    throw new Error("Invitation email does not match the current user");
  }
  return { invitation };
}

async function completeInvitationAcceptance(
  db: DatabaseWriter,
  args: {
    actorUserId: Id<"users">;
    invitation: OrganizationInvitationRecord;
  }
): Promise<ReturnType<typeof sanitizeInvitation>> {
  const now = Date.now();
  if (args.invitation.cancelledAt !== undefined) {
    throw new Error("Invitation has been cancelled");
  }
  if (args.invitation.declinedAt !== undefined) {
    throw new Error("Invitation has already been declined");
  }
  if (args.invitation.acceptedAt !== undefined) {
    throw new Error("Invitation has already been accepted");
  }
  if (args.invitation.expiresAt <= now) {
    throw new Error("Invitation has expired");
  }
  const existingMembership = await getOrganizationMembership(
    db,
    args.invitation.organizationId,
    args.actorUserId
  );
  if (existingMembership) {
    throw new Error("User is already a member of this organization");
  }
  const organization = await db.get(args.invitation.organizationId);
  if (!organization) {
    throw new Error("Organization not found");
  }
  await db.insert("organizationMembers", {
    organizationId: args.invitation.organizationId,
    userId: args.actorUserId,
    roleType: args.invitation.roleType,
    systemRole: args.invitation.systemRole,
    customRoleId: args.invitation.customRoleId,
    createdAt: now,
    updatedAt: now,
  });
  await db.patch(args.invitation._id, {
    acceptedAt: now,
    updatedAt: now,
  });
  const updated = await db.get(args.invitation._id);
  if (!updated) {
    throw new Error("Invitation not found");
  }
  const roleName = await resolveInvitationRoleLabel(db, updated);
  return sanitizeInvitation(updated, roleName);
}

export async function acceptOrganizationInvitation(
  db: DatabaseWriter,
  args: {
    actorUserId: Id<"users">;
    token: string;
    rolePermissions?: RolePermissions;
  }
): Promise<ReturnType<typeof sanitizeInvitation>> {
  const actorEmail = await resolveActorEmailFromDb(db, args.actorUserId);
  const tokenHash = await hashToken(args.token);
  const invitation = await db
    .query("organizationInvitations")
    .withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash))
    .unique();
  if (!invitation) {
    throw new Error("Invitation not found");
  }
  if (normalizeEmail(actorEmail) !== invitation.email) {
    throw new Error("Invitation email does not match the current user");
  }
  return await completeInvitationAcceptance(db, {
    actorUserId: args.actorUserId,
    invitation,
  });
}

export async function acceptIncomingOrganizationInvitation(
  db: DatabaseWriter,
  args: {
    actorUserId: Id<"users">;
    invitationId: Id<"organizationInvitations">;
  }
): Promise<ReturnType<typeof sanitizeInvitation>> {
  const { invitation } = await getIncomingInvitationForActor(db, args);
  return await completeInvitationAcceptance(db, {
    actorUserId: args.actorUserId,
    invitation,
  });
}

export async function cancelOrganizationInvitation(
  db: DatabaseWriter,
  args: {
    actorUserId: Id<"users">;
    invitationId: Id<"organizationInvitations">;
    rolePermissions?: RolePermissions;
  }
): Promise<ReturnType<typeof sanitizeInvitation>> {
  const invitation = await db.get(args.invitationId);
  if (!invitation) {
    throw new Error("Invitation not found");
  }
  await requirePermissionForOrganization(db, {
    organizationId: invitation.organizationId,
    actorUserId: args.actorUserId,
    permission: { resource: "invitation", action: "cancel" },
    rolePermissions: args.rolePermissions,
  });
  if (invitation.cancelledAt !== undefined) {
    return sanitizeInvitation(invitation);
  }
  const now = Date.now();
  await db.patch(invitation._id, {
    cancelledAt: now,
    updatedAt: now,
  });
  const updated = await db.get(invitation._id);
  if (!updated) {
    throw new Error("Invitation not found");
  }
  const roleName = await resolveInvitationRoleLabel(db, updated);
  return sanitizeInvitation(updated, roleName);
}

export async function declineIncomingOrganizationInvitation(
  db: DatabaseWriter,
  args: {
    actorUserId: Id<"users">;
    invitationId: Id<"organizationInvitations">;
  }
): Promise<ReturnType<typeof sanitizeInvitation>> {
  const { invitation } = await getIncomingInvitationForActor(db, args);
  if (invitation.acceptedAt !== undefined) {
    throw new Error("Invitation has already been accepted");
  }
  if (invitation.cancelledAt !== undefined) {
    throw new Error("Invitation has been cancelled");
  }
  if (invitation.declinedAt !== undefined) {
    return sanitizeInvitation(invitation);
  }
  const now = Date.now();
  if (invitation.expiresAt <= now) {
    throw new Error("Invitation has expired");
  }
  await db.patch(invitation._id, {
    declinedAt: now,
    updatedAt: now,
  });
  const updated = await db.get(invitation._id);
  if (!updated) {
    throw new Error("Invitation not found");
  }
  const roleName = await resolveInvitationRoleLabel(db, updated);
  return sanitizeInvitation(updated, roleName);
}

export async function removeOrganizationMember(
  db: DatabaseWriter,
  args: {
    actorUserId: Id<"users">;
    organizationId: Id<"organizations">;
    userId: Id<"users">;
    rolePermissions?: RolePermissions;
  }
): Promise<void> {
  const targetMembership = await getOrganizationMembership(
    db,
    args.organizationId,
    args.userId
  );
  if (!targetMembership) {
    throw new Error("Membership not found");
  }
  if (args.actorUserId === args.userId) {
    if (isOwnerMembership(targetMembership)) {
      throw new Error("Organization owner cannot leave without transferring ownership");
    }
  } else {
    await requirePermissionForOrganization(db, {
      organizationId: args.organizationId,
      actorUserId: args.actorUserId,
      permission: { resource: "member", action: "delete" },
      rolePermissions: args.rolePermissions,
    });
  }
  if (isOwnerMembership(targetMembership)) {
    throw new Error("Organization owner cannot be removed");
  }
  await db.delete(targetMembership._id);
}

export async function setOrganizationMemberRole(
  db: DatabaseWriter,
  args: {
    actorUserId: Id<"users">;
    organizationId: Id<"organizations">;
    userId: Id<"users">;
    role: {
      type: "system" | "custom";
      systemRole?: string;
      customRoleId?: Id<"organizationRoles">;
    };
    rolePermissions?: RolePermissions;
  }
): Promise<ReturnType<typeof sanitizeMembership>> {
  await requirePermissionForOrganization(db, {
    organizationId: args.organizationId,
    actorUserId: args.actorUserId,
    permission: { resource: "member", action: "update" },
    rolePermissions: args.rolePermissions,
  });
  const targetMembership = await getOrganizationMembership(
    db,
    args.organizationId,
    args.userId
  );
  if (!targetMembership) {
    throw new Error("Membership not found");
  }
  if (
    isOwnerMembership(targetMembership) ||
    (args.role.type === SYSTEM_ROLE_TYPE && args.role.systemRole === OWNER_ROLE)
  ) {
    throw new Error("Use transferOwnership to change organization ownership");
  }
  if (args.role.type === CUSTOM_ROLE_TYPE) {
    if (!args.role.customRoleId) {
      throw new Error("Custom organization role is required");
    }
    const customRole = await requireOrganizationRoleRecord(db, args.role.customRoleId);
    if (customRole.organizationId !== args.organizationId) {
      throw new Error("Organization role does not belong to this organization");
    }
  }
  await db.patch(targetMembership._id, {
    roleType: args.role.type,
    systemRole:
      args.role.type === SYSTEM_ROLE_TYPE ? args.role.systemRole : undefined,
    customRoleId:
      args.role.type === CUSTOM_ROLE_TYPE ? args.role.customRoleId : undefined,
    updatedAt: Date.now(),
  });
  const updated = await db.get(targetMembership._id);
  if (!updated) {
    throw new Error("Membership not found");
  }
  const roleName = await resolveMembershipRoleLabel(db, updated);
  return sanitizeMembership(updated, roleName);
}

export async function transferOrganizationOwnership(
  db: DatabaseWriter,
  args: {
    actorUserId: Id<"users">;
    organizationId: Id<"organizations">;
    newOwnerUserId: Id<"users">;
    rolePermissions?: RolePermissions;
  }
): Promise<void> {
  const currentOwner = await requirePermissionForOrganization(db, {
    organizationId: args.organizationId,
    actorUserId: args.actorUserId,
    permission: { resource: "organization", action: "transfer" },
    rolePermissions: args.rolePermissions,
  });
  if (!isOwnerMembership(currentOwner)) {
    throw new Error("Only the current owner can transfer organization ownership");
  }
  const newOwnerMembership = await getOrganizationMembership(
    db,
    args.organizationId,
    args.newOwnerUserId
  );
  if (!newOwnerMembership) {
    throw new Error("New owner must already be a member of the organization");
  }
  const now = Date.now();
  await db.patch(currentOwner._id, {
    roleType: SYSTEM_ROLE_TYPE,
    systemRole: ADMIN_ROLE,
    customRoleId: undefined,
    updatedAt: now,
  });
  await db.patch(newOwnerMembership._id, {
    roleType: SYSTEM_ROLE_TYPE,
    systemRole: OWNER_ROLE,
    customRoleId: undefined,
    updatedAt: now,
  });
}

export async function createOrganizationRole(
  db: DatabaseWriter,
  args: {
    actorUserId: Id<"users">;
    organizationId: Id<"organizations">;
    name: string;
    slug: string;
    description?: string;
    permissions: readonly string[];
    accessControl?: AccessControlMap;
    rolePermissions?: RolePermissions;
  }
): Promise<ReturnType<typeof sanitizeRole>> {
  await requirePermissionForOrganization(db, {
    organizationId: args.organizationId,
    actorUserId: args.actorUserId,
    permission: { resource: "role", action: "create" },
    rolePermissions: args.rolePermissions,
  });
  const slug = normalizeRoleSlug(args.slug);
  const existing = await getOrganizationRoleBySlug(db, args.organizationId, slug);
  if (existing) {
    throw new Error("Organization role slug is already in use");
  }
  const roleId = await db.insert("organizationRoles", {
    organizationId: args.organizationId,
    name: args.name.trim(),
    slug,
    description: args.description?.trim(),
    permissions: normalizePermissionList(args.permissions, args.accessControl),
    createdByUserId: args.actorUserId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  return sanitizeRole(await requireOrganizationRoleRecord(db, roleId));
}

export async function listOrganizationRolesByActor(
  db: DatabaseReader,
  args: {
    actorUserId: Id<"users">;
    organizationId: Id<"organizations">;
    rolePermissions?: RolePermissions;
  }
): Promise<Array<ReturnType<typeof sanitizeRole>>> {
  await requirePermissionForOrganization(db, {
    organizationId: args.organizationId,
    actorUserId: args.actorUserId,
    permission: { resource: "role", action: "read" },
    rolePermissions: args.rolePermissions,
  });
  const roles = await db
    .query("organizationRoles")
    .withIndex("by_organizationId", (q) => q.eq("organizationId", args.organizationId))
    .collect();
  return roles.map((role) => sanitizeRole(role));
}

export async function listAvailableOrganizationPermissionsByActor(
  db: DatabaseReader,
  args: {
    actorUserId: Id<"users">;
    organizationId: Id<"organizations">;
    accessControl?: AccessControlMap;
    rolePermissions?: RolePermissions;
  }
): Promise<ReturnType<typeof serializeAvailablePermissions>> {
  await requirePermissionForOrganization(db, {
    organizationId: args.organizationId,
    actorUserId: args.actorUserId,
    permission: { resource: "accessControl", action: "read" },
    rolePermissions: args.rolePermissions,
  });
  return serializeAvailablePermissions(args.accessControl);
}

export async function getOrganizationRoleByActor(
  db: DatabaseReader,
  args: {
    actorUserId: Id<"users">;
    roleId: Id<"organizationRoles">;
    rolePermissions?: RolePermissions;
  }
): Promise<ReturnType<typeof sanitizeRole> | null> {
  const role = await getOrganizationRole(db, args.roleId);
  if (!role) {
    return null;
  }
  await requirePermissionForOrganization(db, {
    organizationId: role.organizationId,
    actorUserId: args.actorUserId,
    permission: { resource: "role", action: "read" },
    rolePermissions: args.rolePermissions,
  });
  return sanitizeRole(role);
}

export async function updateOrganizationRole(
  db: DatabaseWriter,
  args: {
    actorUserId: Id<"users">;
    roleId: Id<"organizationRoles">;
    name?: string;
    slug?: string;
    description?: string;
    permissions?: readonly string[];
    accessControl?: AccessControlMap;
    rolePermissions?: RolePermissions;
  }
): Promise<ReturnType<typeof sanitizeRole>> {
  const role = await requireOrganizationRoleRecord(db, args.roleId);
  await requirePermissionForOrganization(db, {
    organizationId: role.organizationId,
    actorUserId: args.actorUserId,
    permission: { resource: "role", action: "update" },
    rolePermissions: args.rolePermissions,
  });
  const patch: Partial<OrganizationRoleRecord> = {
    updatedAt: Date.now(),
  };
  if (args.name !== undefined) {
    patch.name = args.name.trim();
  }
  if (args.slug !== undefined) {
    const slug = normalizeRoleSlug(args.slug);
    const existing = await getOrganizationRoleBySlug(db, role.organizationId, slug);
    if (existing && existing._id !== role._id) {
      throw new Error("Organization role slug is already in use");
    }
    patch.slug = slug;
  }
  if (args.description !== undefined) {
    patch.description = args.description.trim();
  }
  if (args.permissions !== undefined) {
    patch.permissions = normalizePermissionList(args.permissions, args.accessControl);
  }
  await db.patch(role._id, patch);
  return sanitizeRole(await requireOrganizationRoleRecord(db, role._id));
}

export async function deleteOrganizationRole(
  db: DatabaseWriter,
  args: {
    actorUserId: Id<"users">;
    roleId: Id<"organizationRoles">;
    rolePermissions?: RolePermissions;
  }
): Promise<void> {
  const role = await requireOrganizationRoleRecord(db, args.roleId);
  await requirePermissionForOrganization(db, {
    organizationId: role.organizationId,
    actorUserId: args.actorUserId,
    permission: { resource: "role", action: "delete" },
    rolePermissions: args.rolePermissions,
  });
  const members = await db
    .query("organizationMembers")
    .withIndex("by_organizationId", (q) => q.eq("organizationId", role.organizationId))
    .collect();
  if (members.some((member) => member.customRoleId === role._id)) {
    throw new Error("Cannot delete organization role while members are assigned to it");
  }
  const invitations = await db
    .query("organizationInvitations")
    .withIndex("by_organizationId", (q) => q.eq("organizationId", role.organizationId))
    .collect();
  if (invitations.some((invitation) => invitation.customRoleId === role._id)) {
    throw new Error(
      "Cannot delete organization role while invitations reference it"
    );
  }
  await db.delete(role._id);
}

export async function addOrganizationDomain(
  db: DatabaseWriter,
  args: {
    actorUserId: Id<"users">;
    organizationId: Id<"organizations">;
    hostname: string;
    rolePermissions?: RolePermissions;
  }
): Promise<ReturnType<typeof sanitizeDomain>> {
  await requirePermissionForOrganization(db, {
    organizationId: args.organizationId,
    actorUserId: args.actorUserId,
    permission: { resource: "domain", action: "create" },
    rolePermissions: args.rolePermissions,
  });
  const hostname = normalizeHostname(args.hostname);
  const existing = await db
    .query("organizationDomains")
    .withIndex("by_hostname", (q) => q.eq("hostname", hostname))
    .unique();
  if (existing) {
    throw new Error("Hostname is already claimed by another organization");
  }
  const now = Date.now();
  const domainId = await db.insert("organizationDomains", {
    organizationId: args.organizationId,
    hostname,
    verificationToken: generateToken(),
    createdAt: now,
    updatedAt: now,
  });
  const domain = await db.get(domainId);
  if (!domain) {
    throw new Error("Failed to create organization domain");
  }
  return sanitizeDomain(domain);
}

export async function listOrganizationDomainsByActor(
  db: DatabaseReader,
  args: {
    actorUserId: Id<"users">;
    organizationId: Id<"organizations">;
    rolePermissions?: RolePermissions;
  }
): Promise<Array<ReturnType<typeof sanitizeDomain>>> {
  await requirePermissionForOrganization(db, {
    organizationId: args.organizationId,
    actorUserId: args.actorUserId,
    permission: { resource: "domain", action: "read" },
    rolePermissions: args.rolePermissions,
  });
  const domains = await db
    .query("organizationDomains")
    .withIndex("by_organizationId", (q) => q.eq("organizationId", args.organizationId))
    .collect();
  return domains.map((domain) => sanitizeDomain(domain));
}

export async function getOrganizationDomainVerificationChallenge(
  db: DatabaseReader,
  args: {
    actorUserId: Id<"users">;
    domainId: Id<"organizationDomains">;
    rolePermissions?: RolePermissions;
  }
): Promise<{
  domainId: Id<"organizationDomains">;
  hostname: string;
  txtRecordName: string;
  txtRecordValue: string;
}> {
  const domain = await db.get(args.domainId);
  if (!domain) {
    throw new Error("Domain not found");
  }
  await requirePermissionForOrganization(db, {
    organizationId: domain.organizationId,
    actorUserId: args.actorUserId,
    permission: { resource: "domain", action: "verify" },
    rolePermissions: args.rolePermissions,
  });
  return {
    domainId: domain._id,
    hostname: domain.hostname,
    txtRecordName: `_convex-zen.${domain.hostname}`,
    txtRecordValue: domain.verificationToken,
  };
}

export async function markOrganizationDomainVerified(
  db: DatabaseWriter,
  args: {
    actorUserId: Id<"users">;
    domainId: Id<"organizationDomains">;
    rolePermissions?: RolePermissions;
  }
): Promise<ReturnType<typeof sanitizeDomain>> {
  const domain = await db.get(args.domainId);
  if (!domain) {
    throw new Error("Domain not found");
  }
  await requirePermissionForOrganization(db, {
    organizationId: domain.organizationId,
    actorUserId: args.actorUserId,
    permission: { resource: "domain", action: "verify" },
    rolePermissions: args.rolePermissions,
  });
  await db.patch(domain._id, {
    verifiedAt: Date.now(),
    updatedAt: Date.now(),
  });
  const updated = await db.get(domain._id);
  if (!updated) {
    throw new Error("Domain not found");
  }
  return sanitizeDomain(updated);
}

export async function removeOrganizationDomain(
  db: DatabaseWriter,
  args: {
    actorUserId: Id<"users">;
    domainId: Id<"organizationDomains">;
    rolePermissions?: RolePermissions;
  }
): Promise<void> {
  const domain = await db.get(args.domainId);
  if (!domain) {
    throw new Error("Domain not found");
  }
  await requirePermissionForOrganization(db, {
    organizationId: domain.organizationId,
    actorUserId: args.actorUserId,
    permission: { resource: "domain", action: "delete" },
    rolePermissions: args.rolePermissions,
  });
  await db.delete(domain._id);
}

export async function resolveOrganizationForHost(
  db: DatabaseReader,
  args: {
    host: string;
    subdomainSuffix?: string;
  }
): Promise<OrganizationRecord | null> {
  const normalizedHost = normalizeHostname(args.host);
  const domain = await db
    .query("organizationDomains")
    .withIndex("by_hostname", (q) => q.eq("hostname", normalizedHost))
    .unique();
  if (domain?.verifiedAt) {
    return await db.get(domain.organizationId);
  }

  const suffix = args.subdomainSuffix?.trim().toLowerCase().replace(/\.$/, "");
  if (!suffix) {
    return null;
  }
  if (normalizedHost === suffix || !normalizedHost.endsWith(`.${suffix}`)) {
    return null;
  }
  const slug = normalizedHost.slice(0, -(suffix.length + 1));
  if (slug.length === 0 || slug.includes(".")) {
    return null;
  }
  return await getOrganizationBySlug(db, slug);
}

export async function hasOrganizationRole(
  db: DatabaseReader,
  args: {
    actorUserId: Id<"users">;
    organizationId: Id<"organizations">;
    role?: string;
    roles?: readonly string[];
  }
): Promise<boolean> {
  const membership = await getOrganizationMembership(
    db,
    args.organizationId,
    args.actorUserId
  );
  if (!membership) {
    return false;
  }
  const roleName = await resolveMembershipRoleLabel(db, membership);
  const allowedRoles = args.role
    ? [args.role]
    : args.roles && args.roles.length > 0
      ? args.roles
      : [];
  return allowedRoles.includes(roleName);
}

export async function requireOrganizationRole(
  db: DatabaseReader,
  args: {
    actorUserId: Id<"users">;
    organizationId: Id<"organizations">;
    role?: string;
    roles?: readonly string[];
  }
): Promise<OrganizationMemberRecord> {
  const membership = await requireMembership(
    db,
    args.organizationId,
    args.actorUserId
  );
  const roleName = await resolveMembershipRoleLabel(db, membership);
  const allowedRoles = args.role
    ? [args.role]
    : args.roles && args.roles.length > 0
      ? args.roles
      : [];
  if (!allowedRoles.includes(roleName)) {
    throw new Error("Forbidden");
  }
  return sanitizeMembership(membership, roleName) as unknown as OrganizationMemberRecord;
}

export async function hasOrganizationPermission(
  db: DatabaseReader,
  args: {
    actorUserId: Id<"users">;
    organizationId: Id<"organizations">;
    permission: OrganizationPermission;
    rolePermissions?: RolePermissions;
  }
): Promise<boolean> {
  const membership = await getOrganizationMembership(
    db,
    args.organizationId,
    args.actorUserId
  );
  if (!membership) {
    return false;
  }
  const grantedPermissions = await resolveGrantedPermissionsForMembership(
    db,
    membership,
    args.rolePermissions
  );
  return grantedPermissions.includes(permissionToken(args.permission));
}

export async function requireOrganizationPermission(
  db: DatabaseReader,
  args: {
    actorUserId: Id<"users">;
    organizationId: Id<"organizations">;
    permission: OrganizationPermission;
    rolePermissions?: RolePermissions;
  }
): Promise<OrganizationMemberRecord> {
  const membership = await requirePermissionForOrganization(db, args);
  const roleName = await resolveMembershipRoleLabel(db, membership);
  return sanitizeMembership(membership, roleName) as unknown as OrganizationMemberRecord;
}

export async function deleteUserOrganizationRelations(
  db: DatabaseWriter,
  userId: Id<"users">
): Promise<void> {
  const user = await db.get(userId);
  const memberships = await db
    .query("organizationMembers")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect();

  for (const membership of memberships) {
    if (!isOwnerMembership(membership)) {
      continue;
    }
    const orgMembers = await db
      .query("organizationMembers")
      .withIndex("by_organizationId", (q) => q.eq("organizationId", membership.organizationId))
      .collect();
    if (orgMembers.length > 1) {
      throw new Error(
        "Cannot delete user while they still own an organization with other members. Transfer ownership first."
      );
    }
  }

  for (const membership of memberships) {
    if (isOwnerMembership(membership)) {
      await deleteOrganizationCascade(db, membership.organizationId);
    } else {
      await db.delete(membership._id);
    }
  }

  const sentInvitations = await db
    .query("organizationInvitations")
    .collect();
  for (const invitation of sentInvitations) {
    if (
      invitation.invitedByUserId === userId ||
      (user && invitation.email === user.email)
    ) {
      await db.delete(invitation._id);
    }
  }
}

const organizationPermissionValidator = v.object({
  resource: v.string(),
  action: v.string(),
});

const organizationRoleAssignmentValidator = v.union(
  v.object({
    type: v.literal("system"),
    systemRole: v.string(),
  }),
  v.object({
    type: v.literal("custom"),
    customRoleId: v.id("organizationRoles"),
  })
);

const accessControlValidator = v.record(v.string(), v.array(v.string()));
const rolePermissionsValidator = v.record(v.string(), v.array(v.string()));

export const checkSlug = internalQuery({
  args: {
    slug: v.string(),
  },
  handler: async (ctx, { slug }) => await checkOrganizationSlugAvailability(ctx.db, slug),
});

export const createOrganization = internalMutation({
  args: {
    actorUserId: v.id("users"),
    allowUserOrganizationCreation: v.optional(v.boolean()),
    name: v.string(),
    slug: v.string(),
    logo: v.optional(v.string()),
  },
  handler: async (ctx, args) => await createOrganizationForUser(ctx.db, args),
});

export const updateOrganization = internalMutation({
  args: {
    actorUserId: v.id("users"),
    organizationId: v.id("organizations"),
    rolePermissions: v.optional(rolePermissionsValidator),
    name: v.optional(v.string()),
    slug: v.optional(v.string()),
    logo: v.optional(v.string()),
  },
  handler: async (ctx, args) => await updateOrganizationByMember(ctx.db, args),
});

export const deleteOrganization = internalMutation({
  args: {
    actorUserId: v.id("users"),
    organizationId: v.id("organizations"),
    rolePermissions: v.optional(rolePermissionsValidator),
  },
  handler: async (ctx, args) => await deleteOrganizationByMember(ctx.db, args),
});

export const listOrganizations = internalQuery({
  args: {
    actorUserId: v.id("users"),
  },
  handler: async (ctx, args) => await listOrganizationsForUser(ctx.db, args.actorUserId),
});

export const getOrganization = internalQuery({
  args: {
    actorUserId: v.id("users"),
    organizationId: v.id("organizations"),
    rolePermissions: v.optional(rolePermissionsValidator),
  },
  handler: async (ctx, args) => await getOrganizationById(ctx.db, args),
});

export const getMembership = internalQuery({
  args: {
    actorUserId: v.id("users"),
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => await getOrganizationMembershipForActor(ctx.db, args),
});

export const listMembers = internalQuery({
  args: {
    actorUserId: v.id("users"),
    organizationId: v.id("organizations"),
    rolePermissions: v.optional(rolePermissionsValidator),
  },
  handler: async (ctx, args) => await listOrganizationMembersByActor(ctx.db, args),
});

export const inviteMember = internalMutation({
  args: {
    actorUserId: v.id("users"),
    organizationId: v.id("organizations"),
    email: v.string(),
    role: organizationRoleAssignmentValidator,
    accessControl: v.optional(accessControlValidator),
    inviteExpiresInMs: v.optional(v.number()),
    rolePermissions: v.optional(rolePermissionsValidator),
  },
  handler: async (ctx, args) => await inviteOrganizationMember(ctx.db, args),
});

export const listInvitations = internalQuery({
  args: {
    actorUserId: v.id("users"),
    organizationId: v.id("organizations"),
    rolePermissions: v.optional(rolePermissionsValidator),
  },
  handler: async (ctx, args) => await listOrganizationInvitationsByActor(ctx.db, args),
});

export const listIncomingInvitations = internalQuery({
  args: {
    actorUserId: v.id("users"),
  },
  handler: async (ctx, args) =>
    await listIncomingOrganizationInvitationsForUser(ctx.db, args),
});

export const acceptInvitation = internalMutation({
  args: {
    actorUserId: v.id("users"),
    token: v.string(),
    rolePermissions: v.optional(rolePermissionsValidator),
  },
  handler: async (ctx, args) => await acceptOrganizationInvitation(ctx.db, args),
});

export const acceptIncomingInvitation = internalMutation({
  args: {
    actorUserId: v.id("users"),
    invitationId: v.id("organizationInvitations"),
  },
  handler: async (ctx, args) =>
    await acceptIncomingOrganizationInvitation(ctx.db, args),
});

export const cancelInvitation = internalMutation({
  args: {
    actorUserId: v.id("users"),
    invitationId: v.id("organizationInvitations"),
    rolePermissions: v.optional(rolePermissionsValidator),
  },
  handler: async (ctx, args) => await cancelOrganizationInvitation(ctx.db, args),
});

export const declineIncomingInvitation = internalMutation({
  args: {
    actorUserId: v.id("users"),
    invitationId: v.id("organizationInvitations"),
  },
  handler: async (ctx, args) =>
    await declineIncomingOrganizationInvitation(ctx.db, args),
});

export const removeMember = internalMutation({
  args: {
    actorUserId: v.id("users"),
    organizationId: v.id("organizations"),
    userId: v.id("users"),
    rolePermissions: v.optional(rolePermissionsValidator),
  },
  handler: async (ctx, args) => await removeOrganizationMember(ctx.db, args),
});

export const setMemberRole = internalMutation({
  args: {
    actorUserId: v.id("users"),
    organizationId: v.id("organizations"),
    userId: v.id("users"),
    role: organizationRoleAssignmentValidator,
    rolePermissions: v.optional(rolePermissionsValidator),
  },
  handler: async (ctx, args) => await setOrganizationMemberRole(ctx.db, args),
});

export const transferOwnership = internalMutation({
  args: {
    actorUserId: v.id("users"),
    organizationId: v.id("organizations"),
    newOwnerUserId: v.id("users"),
    rolePermissions: v.optional(rolePermissionsValidator),
  },
  handler: async (ctx, args) => await transferOrganizationOwnership(ctx.db, args),
});

export const createRole = internalMutation({
  args: {
    actorUserId: v.id("users"),
    organizationId: v.id("organizations"),
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    permissions: v.array(v.string()),
    accessControl: v.optional(accessControlValidator),
    rolePermissions: v.optional(rolePermissionsValidator),
  },
  handler: async (ctx, args) => await createOrganizationRole(ctx.db, args),
});

export const listRoles = internalQuery({
  args: {
    actorUserId: v.id("users"),
    organizationId: v.id("organizations"),
    rolePermissions: v.optional(rolePermissionsValidator),
  },
  handler: async (ctx, args) => ({
    roles: await listOrganizationRolesByActor(ctx.db, args),
  }),
});

export const listAvailablePermissions = internalQuery({
  args: {
    actorUserId: v.id("users"),
    organizationId: v.id("organizations"),
    accessControl: v.optional(accessControlValidator),
    rolePermissions: v.optional(rolePermissionsValidator),
  },
  handler: async (ctx, args) =>
    await listAvailableOrganizationPermissionsByActor(ctx.db, args),
});

export const getRole = internalQuery({
  args: {
    actorUserId: v.id("users"),
    roleId: v.id("organizationRoles"),
    rolePermissions: v.optional(rolePermissionsValidator),
  },
  handler: async (ctx, args) => await getOrganizationRoleByActor(ctx.db, args),
});

export const updateRole = internalMutation({
  args: {
    actorUserId: v.id("users"),
    roleId: v.id("organizationRoles"),
    name: v.optional(v.string()),
    slug: v.optional(v.string()),
    description: v.optional(v.string()),
    permissions: v.optional(v.array(v.string())),
    accessControl: v.optional(accessControlValidator),
    rolePermissions: v.optional(rolePermissionsValidator),
  },
  handler: async (ctx, args) => await updateOrganizationRole(ctx.db, args),
});

export const deleteRole = internalMutation({
  args: {
    actorUserId: v.id("users"),
    roleId: v.id("organizationRoles"),
    rolePermissions: v.optional(rolePermissionsValidator),
  },
  handler: async (ctx, args) => await deleteOrganizationRole(ctx.db, args),
});

export const addDomain = internalMutation({
  args: {
    actorUserId: v.id("users"),
    organizationId: v.id("organizations"),
    hostname: v.string(),
    rolePermissions: v.optional(rolePermissionsValidator),
  },
  handler: async (ctx, args) => await addOrganizationDomain(ctx.db, args),
});

export const listDomains = internalQuery({
  args: {
    actorUserId: v.id("users"),
    organizationId: v.id("organizations"),
    rolePermissions: v.optional(rolePermissionsValidator),
  },
  handler: async (ctx, args) => await listOrganizationDomainsByActor(ctx.db, args),
});

export const getDomainVerificationChallenge = internalQuery({
  args: {
    actorUserId: v.id("users"),
    domainId: v.id("organizationDomains"),
    rolePermissions: v.optional(rolePermissionsValidator),
  },
  handler: async (ctx, args) =>
    await getOrganizationDomainVerificationChallenge(ctx.db, args),
});

export const markDomainVerified = internalMutation({
  args: {
    actorUserId: v.id("users"),
    domainId: v.id("organizationDomains"),
    rolePermissions: v.optional(rolePermissionsValidator),
  },
  handler: async (ctx, args) => await markOrganizationDomainVerified(ctx.db, args),
});

export const removeDomain = internalMutation({
  args: {
    actorUserId: v.id("users"),
    domainId: v.id("organizationDomains"),
    rolePermissions: v.optional(rolePermissionsValidator),
  },
  handler: async (ctx, args) => await removeOrganizationDomain(ctx.db, args),
});

export const resolveOrganizationByHost = internalQuery({
  args: {
    host: v.string(),
    subdomainSuffix: v.optional(v.string()),
  },
  handler: async (ctx, args) => await resolveOrganizationForHost(ctx.db, args),
});

export const hasRole = internalQuery({
  args: {
    actorUserId: v.id("users"),
    organizationId: v.id("organizations"),
    role: v.optional(v.string()),
    roles: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => await hasOrganizationRole(ctx.db, args),
});

export const requireRole = internalQuery({
  args: {
    actorUserId: v.id("users"),
    organizationId: v.id("organizations"),
    role: v.optional(v.string()),
    roles: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => await requireOrganizationRole(ctx.db, args),
});

export const hasPermission = internalQuery({
  args: {
    actorUserId: v.id("users"),
    organizationId: v.id("organizations"),
    permission: organizationPermissionValidator,
    rolePermissions: v.optional(rolePermissionsValidator),
  },
  handler: async (ctx, args) => await hasOrganizationPermission(ctx.db, args),
});

export const requirePermission = internalQuery({
  args: {
    actorUserId: v.id("users"),
    organizationId: v.id("organizations"),
    permission: organizationPermissionValidator,
    rolePermissions: v.optional(rolePermissionsValidator),
  },
  handler: async (ctx, args) => await requireOrganizationPermission(ctx.db, args),
});
