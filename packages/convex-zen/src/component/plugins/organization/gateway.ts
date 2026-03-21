import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import {
  acceptIncomingOrganizationInvitation,
  acceptOrganizationInvitation,
  addOrganizationDomain,
  cancelOrganizationInvitation,
  checkOrganizationSlugAvailability,
  createOrganizationForUser,
  createOrganizationRole,
  declineIncomingOrganizationInvitation,
  deleteOrganizationByMember,
  deleteOrganizationRole,
  getOrganizationById,
  getOrganizationDomainVerificationChallenge,
  getOrganizationMembershipForActor,
  getOrganizationRoleByActor,
  hasOrganizationPermission,
  hasOrganizationRole,
  inviteOrganizationMember,
  listAvailableOrganizationPermissionsByActor,
  listIncomingOrganizationInvitationsForUser,
  listOrganizationDomainsByActor,
  listOrganizationInvitationsByActor,
  listOrganizationMembersByActor,
  listOrganizationsForUser,
  listOrganizationRolesByActor,
  markOrganizationDomainVerified,
  removeOrganizationDomain,
  removeOrganizationMember,
  requireOrganizationPermission,
  requireOrganizationRole,
  resolveOrganizationForHost,
  setOrganizationMemberRole,
  transferOrganizationOwnership,
  updateOrganizationByMember,
  updateOrganizationRole,
} from "../organization";

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
    customRoleId: v.string(),
  })
);

const accessControlValidator = v.record(v.string(), v.array(v.string()));
const rolePermissionsValidator = v.record(v.string(), v.array(v.string()));

export const checkSlug = query({
  args: {
    slug: v.string(),
  },
  handler: async (ctx, { slug }) =>
    await checkOrganizationSlugAvailability(ctx.db, slug),
});

export const createOrganization = mutation({
  args: {
    actorUserId: v.string(),
    allowUserOrganizationCreation: v.optional(v.boolean()),
    name: v.string(),
    slug: v.string(),
    logo: v.optional(v.string()),
  },
  handler: async (
    ctx,
    { actorUserId, allowUserOrganizationCreation, name, slug, logo }
  ) =>
    await createOrganizationForUser(ctx.db, {
      actorUserId: actorUserId as Id<"users">,
      allowUserOrganizationCreation,
      name,
      slug,
      logo,
    }),
});

export const updateOrganization = mutation({
  args: {
    actorUserId: v.string(),
    organizationId: v.string(),
    rolePermissions: v.optional(rolePermissionsValidator),
    name: v.optional(v.string()),
    slug: v.optional(v.string()),
    logo: v.optional(v.string()),
  },
  handler: async (
    ctx,
    { actorUserId, organizationId, rolePermissions, name, slug, logo }
  ) =>
    await updateOrganizationByMember(ctx.db, {
      actorUserId: actorUserId as Id<"users">,
      organizationId: organizationId as Id<"organizations">,
      rolePermissions,
      name,
      slug,
      logo,
    }),
});

export const deleteOrganization = mutation({
  args: {
    actorUserId: v.string(),
    organizationId: v.string(),
    rolePermissions: v.optional(rolePermissionsValidator),
  },
  handler: async (ctx, { actorUserId, organizationId, rolePermissions }) =>
    await deleteOrganizationByMember(ctx.db, {
      actorUserId: actorUserId as Id<"users">,
      organizationId: organizationId as Id<"organizations">,
      rolePermissions,
    }),
});

export const listOrganizations = query({
  args: {
    actorUserId: v.string(),
  },
  handler: async (ctx, { actorUserId }) =>
    await listOrganizationsForUser(ctx.db, actorUserId as Id<"users">),
});

export const getOrganization = query({
  args: {
    actorUserId: v.string(),
    organizationId: v.string(),
    rolePermissions: v.optional(rolePermissionsValidator),
  },
  handler: async (ctx, { actorUserId, organizationId, rolePermissions }) =>
    await getOrganizationById(ctx.db, {
      actorUserId: actorUserId as Id<"users">,
      organizationId: organizationId as Id<"organizations">,
      rolePermissions,
    }),
});

export const getMembership = query({
  args: {
    actorUserId: v.string(),
    organizationId: v.string(),
  },
  handler: async (ctx, { actorUserId, organizationId }) =>
    await getOrganizationMembershipForActor(ctx.db, {
      actorUserId: actorUserId as Id<"users">,
      organizationId: organizationId as Id<"organizations">,
    }),
});

export const listMembers = query({
  args: {
    actorUserId: v.string(),
    organizationId: v.string(),
    rolePermissions: v.optional(rolePermissionsValidator),
  },
  handler: async (ctx, { actorUserId, organizationId, rolePermissions }) =>
    await listOrganizationMembersByActor(ctx.db, {
      actorUserId: actorUserId as Id<"users">,
      organizationId: organizationId as Id<"organizations">,
      rolePermissions,
    }),
});

export const inviteMember = mutation({
  args: {
    actorUserId: v.string(),
    organizationId: v.string(),
    email: v.string(),
    role: organizationRoleAssignmentValidator,
    accessControl: v.optional(accessControlValidator),
    inviteExpiresInMs: v.optional(v.number()),
    rolePermissions: v.optional(rolePermissionsValidator),
  },
  handler: async (
    ctx,
    {
      actorUserId,
      organizationId,
      email,
      role,
      accessControl,
      inviteExpiresInMs,
      rolePermissions,
    }
  ) =>
    await inviteOrganizationMember(ctx.db, {
      actorUserId: actorUserId as Id<"users">,
      organizationId: organizationId as Id<"organizations">,
      email,
      role:
        role.type === "system"
          ? { type: "system", systemRole: role.systemRole }
          : { type: "custom", customRoleId: role.customRoleId as Id<"organizationRoles"> },
      accessControl,
      inviteExpiresInMs,
      rolePermissions,
    }),
});

export const listInvitations = query({
  args: {
    actorUserId: v.string(),
    organizationId: v.string(),
    rolePermissions: v.optional(rolePermissionsValidator),
  },
  handler: async (ctx, { actorUserId, organizationId, rolePermissions }) =>
    await listOrganizationInvitationsByActor(ctx.db, {
      actorUserId: actorUserId as Id<"users">,
      organizationId: organizationId as Id<"organizations">,
      rolePermissions,
    }),
});

export const listIncomingInvitations = query({
  args: {
    actorUserId: v.string(),
    actorEmail: v.optional(v.string()),
  },
  handler: async (ctx, { actorUserId, actorEmail }) =>
    await listIncomingOrganizationInvitationsForUser(ctx.db, {
      actorUserId: actorUserId as Id<"users">,
      actorEmail,
    }),
});

export const acceptInvitation = mutation({
  args: {
    actorUserId: v.string(),
    actorEmail: v.optional(v.string()),
    token: v.string(),
    rolePermissions: v.optional(rolePermissionsValidator),
  },
  handler: async (ctx, { actorUserId, actorEmail, token, rolePermissions }) =>
    await acceptOrganizationInvitation(ctx.db, {
      actorUserId: actorUserId as Id<"users">,
      actorEmail,
      token,
      rolePermissions,
    }),
});

export const acceptIncomingInvitation = mutation({
  args: {
    actorUserId: v.string(),
    actorEmail: v.optional(v.string()),
    invitationId: v.string(),
  },
  handler: async (ctx, { actorUserId, actorEmail, invitationId }) =>
    await acceptIncomingOrganizationInvitation(ctx.db, {
      actorUserId: actorUserId as Id<"users">,
      actorEmail,
      invitationId: invitationId as Id<"organizationInvitations">,
    }),
});

export const cancelInvitation = mutation({
  args: {
    actorUserId: v.string(),
    invitationId: v.string(),
    rolePermissions: v.optional(rolePermissionsValidator),
  },
  handler: async (ctx, { actorUserId, invitationId, rolePermissions }) =>
    await cancelOrganizationInvitation(ctx.db, {
      actorUserId: actorUserId as Id<"users">,
      invitationId: invitationId as Id<"organizationInvitations">,
      rolePermissions,
    }),
});

export const declineIncomingInvitation = mutation({
  args: {
    actorUserId: v.string(),
    actorEmail: v.optional(v.string()),
    invitationId: v.string(),
  },
  handler: async (ctx, { actorUserId, actorEmail, invitationId }) =>
    await declineIncomingOrganizationInvitation(ctx.db, {
      actorUserId: actorUserId as Id<"users">,
      actorEmail,
      invitationId: invitationId as Id<"organizationInvitations">,
    }),
});

export const removeMember = mutation({
  args: {
    actorUserId: v.string(),
    organizationId: v.string(),
    userId: v.string(),
    rolePermissions: v.optional(rolePermissionsValidator),
  },
  handler: async (ctx, { actorUserId, organizationId, userId, rolePermissions }) =>
    await removeOrganizationMember(ctx.db, {
      actorUserId: actorUserId as Id<"users">,
      organizationId: organizationId as Id<"organizations">,
      userId: userId as Id<"users">,
      rolePermissions,
    }),
});

export const setMemberRole = mutation({
  args: {
    actorUserId: v.string(),
    organizationId: v.string(),
    userId: v.string(),
    role: organizationRoleAssignmentValidator,
    rolePermissions: v.optional(rolePermissionsValidator),
  },
  handler: async (ctx, { actorUserId, organizationId, userId, role, rolePermissions }) =>
    await setOrganizationMemberRole(ctx.db, {
      actorUserId: actorUserId as Id<"users">,
      organizationId: organizationId as Id<"organizations">,
      userId: userId as Id<"users">,
      role:
        role.type === "system"
          ? { type: "system", systemRole: role.systemRole }
          : { type: "custom", customRoleId: role.customRoleId as Id<"organizationRoles"> },
      rolePermissions,
    }),
});

export const createRole = mutation({
  args: {
    actorUserId: v.string(),
    organizationId: v.string(),
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    permissions: v.array(v.string()),
    accessControl: v.optional(accessControlValidator),
    rolePermissions: v.optional(rolePermissionsValidator),
  },
  handler: async (
    ctx,
    {
      actorUserId,
      organizationId,
      name,
      slug,
      description,
      permissions,
      accessControl,
      rolePermissions,
    }
  ) =>
    await createOrganizationRole(ctx.db, {
      actorUserId: actorUserId as Id<"users">,
      organizationId: organizationId as Id<"organizations">,
      name,
      slug,
      description,
      permissions,
      accessControl,
      rolePermissions,
    }),
});

export const listRoles = query({
  args: {
    actorUserId: v.string(),
    organizationId: v.string(),
    rolePermissions: v.optional(rolePermissionsValidator),
  },
  handler: async (ctx, { actorUserId, organizationId, rolePermissions }) => ({
    roles: await listOrganizationRolesByActor(ctx.db, {
      actorUserId: actorUserId as Id<"users">,
      organizationId: organizationId as Id<"organizations">,
      rolePermissions,
    }),
  }),
});

export const listAvailablePermissions = query({
  args: {
    actorUserId: v.string(),
    organizationId: v.string(),
    accessControl: v.optional(accessControlValidator),
    rolePermissions: v.optional(rolePermissionsValidator),
  },
  handler: async (
    ctx,
    { actorUserId, organizationId, accessControl, rolePermissions }
  ) =>
    await listAvailableOrganizationPermissionsByActor(ctx.db, {
      actorUserId: actorUserId as Id<"users">,
      organizationId: organizationId as Id<"organizations">,
      accessControl,
      rolePermissions,
    }),
});

export const getRole = query({
  args: {
    actorUserId: v.string(),
    roleId: v.string(),
    rolePermissions: v.optional(rolePermissionsValidator),
  },
  handler: async (ctx, { actorUserId, roleId, rolePermissions }) =>
    await getOrganizationRoleByActor(ctx.db, {
      actorUserId: actorUserId as Id<"users">,
      roleId: roleId as Id<"organizationRoles">,
      rolePermissions,
    }),
});

export const updateRole = mutation({
  args: {
    actorUserId: v.string(),
    roleId: v.string(),
    name: v.optional(v.string()),
    slug: v.optional(v.string()),
    description: v.optional(v.string()),
    permissions: v.optional(v.array(v.string())),
    accessControl: v.optional(accessControlValidator),
    rolePermissions: v.optional(rolePermissionsValidator),
  },
  handler: async (
    ctx,
    {
      actorUserId,
      roleId,
      name,
      slug,
      description,
      permissions,
      accessControl,
      rolePermissions,
    }
  ) =>
    await updateOrganizationRole(ctx.db, {
      actorUserId: actorUserId as Id<"users">,
      roleId: roleId as Id<"organizationRoles">,
      name,
      slug,
      description,
      permissions,
      accessControl,
      rolePermissions,
    }),
});

export const deleteRole = mutation({
  args: {
    actorUserId: v.string(),
    roleId: v.string(),
    rolePermissions: v.optional(rolePermissionsValidator),
  },
  handler: async (ctx, { actorUserId, roleId, rolePermissions }) =>
    await deleteOrganizationRole(ctx.db, {
      actorUserId: actorUserId as Id<"users">,
      roleId: roleId as Id<"organizationRoles">,
      rolePermissions,
    }),
});

export const transferOwnership = mutation({
  args: {
    actorUserId: v.string(),
    organizationId: v.string(),
    newOwnerUserId: v.string(),
    rolePermissions: v.optional(rolePermissionsValidator),
  },
  handler: async (
    ctx,
    { actorUserId, organizationId, newOwnerUserId, rolePermissions }
  ) =>
    await transferOrganizationOwnership(ctx.db, {
      actorUserId: actorUserId as Id<"users">,
      organizationId: organizationId as Id<"organizations">,
      newOwnerUserId: newOwnerUserId as Id<"users">,
      rolePermissions,
    }),
});

export const addDomain = mutation({
  args: {
    actorUserId: v.string(),
    organizationId: v.string(),
    hostname: v.string(),
    rolePermissions: v.optional(rolePermissionsValidator),
  },
  handler: async (ctx, { actorUserId, organizationId, hostname, rolePermissions }) =>
    await addOrganizationDomain(ctx.db, {
      actorUserId: actorUserId as Id<"users">,
      organizationId: organizationId as Id<"organizations">,
      hostname,
      rolePermissions,
    }),
});

export const listDomains = query({
  args: {
    actorUserId: v.string(),
    organizationId: v.string(),
    rolePermissions: v.optional(rolePermissionsValidator),
  },
  handler: async (ctx, { actorUserId, organizationId, rolePermissions }) =>
    await listOrganizationDomainsByActor(ctx.db, {
      actorUserId: actorUserId as Id<"users">,
      organizationId: organizationId as Id<"organizations">,
      rolePermissions,
    }),
});

export const getDomainVerificationChallenge = query({
  args: {
    actorUserId: v.string(),
    domainId: v.string(),
    rolePermissions: v.optional(rolePermissionsValidator),
  },
  handler: async (ctx, { actorUserId, domainId, rolePermissions }) =>
    await getOrganizationDomainVerificationChallenge(ctx.db, {
      actorUserId: actorUserId as Id<"users">,
      domainId: domainId as Id<"organizationDomains">,
      rolePermissions,
    }),
});

export const markDomainVerified = mutation({
  args: {
    actorUserId: v.string(),
    domainId: v.string(),
    rolePermissions: v.optional(rolePermissionsValidator),
  },
  handler: async (ctx, { actorUserId, domainId, rolePermissions }) =>
    await markOrganizationDomainVerified(ctx.db, {
      actorUserId: actorUserId as Id<"users">,
      domainId: domainId as Id<"organizationDomains">,
      rolePermissions,
    }),
});

export const removeDomain = mutation({
  args: {
    actorUserId: v.string(),
    domainId: v.string(),
    rolePermissions: v.optional(rolePermissionsValidator),
  },
  handler: async (ctx, { actorUserId, domainId, rolePermissions }) =>
    await removeOrganizationDomain(ctx.db, {
      actorUserId: actorUserId as Id<"users">,
      domainId: domainId as Id<"organizationDomains">,
      rolePermissions,
    }),
});

export const resolveOrganizationByHost = query({
  args: {
    host: v.string(),
    subdomainSuffix: v.optional(v.string()),
  },
  handler: async (ctx, args) => await resolveOrganizationForHost(ctx.db, args),
});

export const hasRole = query({
  args: {
    actorUserId: v.string(),
    organizationId: v.string(),
    role: v.optional(v.string()),
    roles: v.optional(v.array(v.string())),
  },
  handler: async (ctx, { actorUserId, organizationId, role, roles }) =>
    await hasOrganizationRole(ctx.db, {
      actorUserId: actorUserId as Id<"users">,
      organizationId: organizationId as Id<"organizations">,
      role,
      roles,
    }),
});

export const requireRole = query({
  args: {
    actorUserId: v.string(),
    organizationId: v.string(),
    role: v.optional(v.string()),
    roles: v.optional(v.array(v.string())),
  },
  handler: async (ctx, { actorUserId, organizationId, role, roles }) =>
    await requireOrganizationRole(ctx.db, {
      actorUserId: actorUserId as Id<"users">,
      organizationId: organizationId as Id<"organizations">,
      role,
      roles,
    }),
});

export const hasPermission = query({
  args: {
    actorUserId: v.string(),
    organizationId: v.string(),
    permission: organizationPermissionValidator,
    rolePermissions: v.optional(rolePermissionsValidator),
  },
  handler: async (ctx, { actorUserId, organizationId, permission, rolePermissions }) =>
    await hasOrganizationPermission(ctx.db, {
      actorUserId: actorUserId as Id<"users">,
      organizationId: organizationId as Id<"organizations">,
      permission,
      rolePermissions,
    }),
});

export const requirePermission = query({
  args: {
    actorUserId: v.string(),
    organizationId: v.string(),
    permission: organizationPermissionValidator,
    rolePermissions: v.optional(rolePermissionsValidator),
  },
  handler: async (ctx, { actorUserId, organizationId, permission, rolePermissions }) =>
    await requireOrganizationPermission(ctx.db, {
      actorUserId: actorUserId as Id<"users">,
      organizationId: organizationId as Id<"organizations">,
      permission,
      rolePermissions,
    }),
});
