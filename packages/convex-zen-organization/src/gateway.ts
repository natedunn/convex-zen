import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import type {
  MutationCtx,
  QueryCtx,
} from "../../convex-zen/src/component/_generated/server";
import type { Id } from "../../convex-zen/src/component/_generated/dataModel";
import { pluginMutation, pluginQuery } from "convex-zen/component";
import { omitUndefined } from "../../convex-zen/src/component/lib/object";
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
  deleteUserOrganizationRelations,
  requireOrganizationPermission,
  requireOrganizationRole,
  resolveOrganizationForHost,
  setOrganizationMemberRole,
  transferOrganizationOwnership,
  updateOrganizationByMember,
  updateOrganizationRole,
} from "./component";

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

export const checkSlug = pluginQuery({
  auth: "public",
  args: {
    slug: v.string(),
  },
  handler: async (ctx: QueryCtx, { slug }) =>
    await checkOrganizationSlugAvailability(ctx.db, slug),
});

export const createOrganization = pluginMutation({
  auth: "actor",
  args: {
    actorUserId: v.string(),
    allowUserOrganizationCreation: v.optional(v.boolean()),
    name: v.string(),
    slug: v.string(),
    logo: v.optional(v.string()),
  },
  handler: async (
    ctx: MutationCtx,
    { actorUserId, allowUserOrganizationCreation, name, slug, logo }
  ) =>
    await createOrganizationForUser(ctx.db, omitUndefined({
      actorUserId: actorUserId as Id<"users">,
      allowUserOrganizationCreation,
      name,
      slug,
      logo,
    })),
});

export const updateOrganization = pluginMutation({
  auth: "actor",
  args: {
    actorUserId: v.string(),
    organizationId: v.string(),
    rolePermissions: v.optional(rolePermissionsValidator),
    name: v.optional(v.string()),
    slug: v.optional(v.string()),
    logo: v.optional(v.string()),
  },
  handler: async (
    ctx: MutationCtx,
    { actorUserId, organizationId, rolePermissions, name, slug, logo }
  ) =>
    await updateOrganizationByMember(ctx.db, omitUndefined({
      actorUserId: actorUserId as Id<"users">,
      organizationId: organizationId as Id<"organizations">,
      rolePermissions,
      name,
      slug,
      logo,
    })),
});

export const deleteOrganization = pluginMutation({
  auth: "actor",
  args: {
    actorUserId: v.string(),
    organizationId: v.string(),
    rolePermissions: v.optional(rolePermissionsValidator),
  },
  handler: async (ctx: MutationCtx, { actorUserId, organizationId, rolePermissions }) =>
    await deleteOrganizationByMember(ctx.db, omitUndefined({
      actorUserId: actorUserId as Id<"users">,
      organizationId: organizationId as Id<"organizations">,
      rolePermissions,
    })),
});

export const listOrganizations = pluginQuery({
  auth: "actor",
  args: {
    actorUserId: v.string(),
  },
  handler: async (ctx: QueryCtx, { actorUserId }) =>
    await listOrganizationsForUser(ctx.db, actorUserId as Id<"users">),
});

export const getOrganization = pluginQuery({
  auth: "actor",
  args: {
    actorUserId: v.string(),
    organizationId: v.string(),
    rolePermissions: v.optional(rolePermissionsValidator),
  },
  handler: async (ctx: QueryCtx, { actorUserId, organizationId, rolePermissions }) =>
    await getOrganizationById(ctx.db, omitUndefined({
      actorUserId: actorUserId as Id<"users">,
      organizationId: organizationId as Id<"organizations">,
      rolePermissions,
    })),
});

export const getMembership = pluginQuery({
  auth: "actor",
  args: {
    actorUserId: v.string(),
    organizationId: v.string(),
  },
  handler: async (ctx: QueryCtx, { actorUserId, organizationId }) =>
    await getOrganizationMembershipForActor(ctx.db, {
      actorUserId: actorUserId as Id<"users">,
      organizationId: organizationId as Id<"organizations">,
    }),
});

export const listMembers = pluginQuery({
  auth: "actor",
  args: {
    actorUserId: v.string(),
    organizationId: v.string(),
    rolePermissions: v.optional(rolePermissionsValidator),
  },
  handler: async (ctx: QueryCtx, { actorUserId, organizationId, rolePermissions }) =>
    await listOrganizationMembersByActor(ctx.db, omitUndefined({
      actorUserId: actorUserId as Id<"users">,
      organizationId: organizationId as Id<"organizations">,
      rolePermissions,
    })),
});

export const inviteMember = pluginMutation({
  auth: "actor",
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
    ctx: MutationCtx,
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
    await inviteOrganizationMember(ctx.db, omitUndefined({
      actorUserId: actorUserId as Id<"users">,
      organizationId: organizationId as Id<"organizations">,
      email,
      role:
        role.type === "system"
          ? { type: "system" as const, systemRole: role.systemRole }
          : {
              type: "custom" as const,
              customRoleId: role.customRoleId as Id<"organizationRoles">,
            },
      accessControl,
      inviteExpiresInMs,
      rolePermissions,
    })),
});

export const listInvitations = pluginQuery({
  auth: "actor",
  args: {
    actorUserId: v.string(),
    organizationId: v.string(),
    rolePermissions: v.optional(rolePermissionsValidator),
  },
  handler: async (ctx: QueryCtx, { actorUserId, organizationId, rolePermissions }) =>
    await listOrganizationInvitationsByActor(ctx.db, omitUndefined({
      actorUserId: actorUserId as Id<"users">,
      organizationId: organizationId as Id<"organizations">,
      rolePermissions,
    })),
});

export const listIncomingInvitations = pluginQuery({
  auth: "actor",
  actor: { actorEmail: true },
  args: {
    actorUserId: v.string(),
    actorEmail: v.optional(v.string()),
  },
  handler: async (ctx: QueryCtx, { actorUserId, actorEmail }) =>
    await listIncomingOrganizationInvitationsForUser(ctx.db, omitUndefined({
      actorUserId: actorUserId as Id<"users">,
      actorEmail,
    })),
});

export const acceptInvitation = pluginMutation({
  auth: "actor",
  actor: { actorEmail: true },
  args: {
    actorUserId: v.string(),
    actorEmail: v.optional(v.string()),
    token: v.string(),
    rolePermissions: v.optional(rolePermissionsValidator),
  },
  handler: async (ctx: MutationCtx, { actorUserId, actorEmail, token, rolePermissions }) =>
    await acceptOrganizationInvitation(ctx.db, omitUndefined({
      actorUserId: actorUserId as Id<"users">,
      actorEmail,
      token,
      rolePermissions,
    })),
});

export const acceptIncomingInvitation = pluginMutation({
  auth: "actor",
  actor: { actorEmail: true },
  args: {
    actorUserId: v.string(),
    actorEmail: v.optional(v.string()),
    invitationId: v.string(),
  },
  handler: async (ctx: MutationCtx, { actorUserId, actorEmail, invitationId }) =>
    await acceptIncomingOrganizationInvitation(ctx.db, omitUndefined({
      actorUserId: actorUserId as Id<"users">,
      actorEmail,
      invitationId: invitationId as Id<"organizationInvitations">,
    })),
});

export const cancelInvitation = pluginMutation({
  auth: "actor",
  args: {
    actorUserId: v.string(),
    invitationId: v.string(),
    rolePermissions: v.optional(rolePermissionsValidator),
  },
  handler: async (ctx: MutationCtx, { actorUserId, invitationId, rolePermissions }) =>
    await cancelOrganizationInvitation(ctx.db, omitUndefined({
      actorUserId: actorUserId as Id<"users">,
      invitationId: invitationId as Id<"organizationInvitations">,
      rolePermissions,
    })),
});

export const declineIncomingInvitation = pluginMutation({
  auth: "actor",
  actor: { actorEmail: true },
  args: {
    actorUserId: v.string(),
    actorEmail: v.optional(v.string()),
    invitationId: v.string(),
  },
  handler: async (ctx: MutationCtx, { actorUserId, actorEmail, invitationId }) =>
    await declineIncomingOrganizationInvitation(ctx.db, omitUndefined({
      actorUserId: actorUserId as Id<"users">,
      actorEmail,
      invitationId: invitationId as Id<"organizationInvitations">,
    })),
});

export const removeMember = pluginMutation({
  auth: "actor",
  args: {
    actorUserId: v.string(),
    organizationId: v.string(),
    userId: v.string(),
    rolePermissions: v.optional(rolePermissionsValidator),
  },
  handler: async (ctx: MutationCtx, { actorUserId, organizationId, userId, rolePermissions }) =>
    await removeOrganizationMember(ctx.db, omitUndefined({
      actorUserId: actorUserId as Id<"users">,
      organizationId: organizationId as Id<"organizations">,
      userId: userId as Id<"users">,
      rolePermissions,
    })),
});

export const setMemberRole = pluginMutation({
  auth: "actor",
  args: {
    actorUserId: v.string(),
    organizationId: v.string(),
    userId: v.string(),
    role: organizationRoleAssignmentValidator,
    rolePermissions: v.optional(rolePermissionsValidator),
  },
  handler: async (ctx: MutationCtx, { actorUserId, organizationId, userId, role, rolePermissions }) =>
    await setOrganizationMemberRole(ctx.db, omitUndefined({
      actorUserId: actorUserId as Id<"users">,
      organizationId: organizationId as Id<"organizations">,
      userId: userId as Id<"users">,
      role:
        role.type === "system"
          ? { type: "system" as const, systemRole: role.systemRole }
          : {
              type: "custom" as const,
              customRoleId: role.customRoleId as Id<"organizationRoles">,
            },
      rolePermissions,
    })),
});

export const createRole = pluginMutation({
  auth: "actor",
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
    ctx: MutationCtx,
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
    await createOrganizationRole(ctx.db, omitUndefined({
      actorUserId: actorUserId as Id<"users">,
      organizationId: organizationId as Id<"organizations">,
      name,
      slug,
      description,
      permissions,
      accessControl,
      rolePermissions,
    })),
});

export const listRoles = pluginQuery({
  auth: "actor",
  args: {
    actorUserId: v.string(),
    organizationId: v.string(),
    rolePermissions: v.optional(rolePermissionsValidator),
  },
  handler: async (ctx: QueryCtx, { actorUserId, organizationId, rolePermissions }) => ({
    roles: await listOrganizationRolesByActor(ctx.db, omitUndefined({
      actorUserId: actorUserId as Id<"users">,
      organizationId: organizationId as Id<"organizations">,
      rolePermissions,
    })),
  }),
});

export const listAvailablePermissions = pluginQuery({
  auth: "actor",
  args: {
    actorUserId: v.string(),
    organizationId: v.string(),
    accessControl: v.optional(accessControlValidator),
    rolePermissions: v.optional(rolePermissionsValidator),
  },
  handler: async (
    ctx: QueryCtx,
    { actorUserId, organizationId, accessControl, rolePermissions }
  ) =>
    await listAvailableOrganizationPermissionsByActor(ctx.db, omitUndefined({
      actorUserId: actorUserId as Id<"users">,
      organizationId: organizationId as Id<"organizations">,
      accessControl,
      rolePermissions,
    })),
});

export const getRole = pluginQuery({
  auth: "actor",
  args: {
    actorUserId: v.string(),
    roleId: v.string(),
    rolePermissions: v.optional(rolePermissionsValidator),
  },
  handler: async (ctx: QueryCtx, { actorUserId, roleId, rolePermissions }) =>
    await getOrganizationRoleByActor(ctx.db, omitUndefined({
      actorUserId: actorUserId as Id<"users">,
      roleId: roleId as Id<"organizationRoles">,
      rolePermissions,
    })),
});

export const updateRole = pluginMutation({
  auth: "actor",
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
    ctx: MutationCtx,
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
    await updateOrganizationRole(ctx.db, omitUndefined({
      actorUserId: actorUserId as Id<"users">,
      roleId: roleId as Id<"organizationRoles">,
      name,
      slug,
      description,
      permissions,
      accessControl,
      rolePermissions,
    })),
});

export const deleteRole = pluginMutation({
  auth: "actor",
  args: {
    actorUserId: v.string(),
    roleId: v.string(),
    rolePermissions: v.optional(rolePermissionsValidator),
  },
  handler: async (ctx: MutationCtx, { actorUserId, roleId, rolePermissions }) =>
    await deleteOrganizationRole(ctx.db, omitUndefined({
      actorUserId: actorUserId as Id<"users">,
      roleId: roleId as Id<"organizationRoles">,
      rolePermissions,
    })),
});

export const transferOwnership = pluginMutation({
  auth: "actor",
  args: {
    actorUserId: v.string(),
    organizationId: v.string(),
    newOwnerUserId: v.string(),
    rolePermissions: v.optional(rolePermissionsValidator),
  },
  handler: async (
    ctx: MutationCtx,
    { actorUserId, organizationId, newOwnerUserId, rolePermissions }
  ) =>
    await transferOrganizationOwnership(ctx.db, omitUndefined({
      actorUserId: actorUserId as Id<"users">,
      organizationId: organizationId as Id<"organizations">,
      newOwnerUserId: newOwnerUserId as Id<"users">,
      rolePermissions,
    })),
});

export const addDomain = pluginMutation({
  auth: "actor",
  args: {
    actorUserId: v.string(),
    organizationId: v.string(),
    hostname: v.string(),
    rolePermissions: v.optional(rolePermissionsValidator),
  },
  handler: async (ctx: MutationCtx, { actorUserId, organizationId, hostname, rolePermissions }) =>
    await addOrganizationDomain(ctx.db, omitUndefined({
      actorUserId: actorUserId as Id<"users">,
      organizationId: organizationId as Id<"organizations">,
      hostname,
      rolePermissions,
    })),
});

export const listDomains = pluginQuery({
  auth: "actor",
  args: {
    actorUserId: v.string(),
    organizationId: v.string(),
    rolePermissions: v.optional(rolePermissionsValidator),
  },
  handler: async (ctx: QueryCtx, { actorUserId, organizationId, rolePermissions }) =>
    await listOrganizationDomainsByActor(ctx.db, omitUndefined({
      actorUserId: actorUserId as Id<"users">,
      organizationId: organizationId as Id<"organizations">,
      rolePermissions,
    })),
});

export const getDomainVerificationChallenge = pluginQuery({
  auth: "actor",
  args: {
    actorUserId: v.string(),
    domainId: v.string(),
    rolePermissions: v.optional(rolePermissionsValidator),
  },
  handler: async (ctx: QueryCtx, { actorUserId, domainId, rolePermissions }) =>
    await getOrganizationDomainVerificationChallenge(ctx.db, omitUndefined({
      actorUserId: actorUserId as Id<"users">,
      domainId: domainId as Id<"organizationDomains">,
      rolePermissions,
    })),
});

export const markDomainVerified = pluginMutation({
  auth: "actor",
  args: {
    actorUserId: v.string(),
    domainId: v.string(),
    rolePermissions: v.optional(rolePermissionsValidator),
  },
  handler: async (ctx: MutationCtx, { actorUserId, domainId, rolePermissions }) =>
    await markOrganizationDomainVerified(ctx.db, omitUndefined({
      actorUserId: actorUserId as Id<"users">,
      domainId: domainId as Id<"organizationDomains">,
      rolePermissions,
    })),
});

export const removeDomain = pluginMutation({
  auth: "actor",
  args: {
    actorUserId: v.string(),
    domainId: v.string(),
    rolePermissions: v.optional(rolePermissionsValidator),
  },
  handler: async (ctx: MutationCtx, { actorUserId, domainId, rolePermissions }) =>
    await removeOrganizationDomain(ctx.db, omitUndefined({
      actorUserId: actorUserId as Id<"users">,
      domainId: domainId as Id<"organizationDomains">,
      rolePermissions,
    })),
});

export const resolveOrganizationByHost = pluginQuery({
  auth: "public",
  args: {
    host: v.string(),
    subdomainSuffix: v.optional(v.string()),
  },
  handler: async (ctx: QueryCtx, args) =>
    await resolveOrganizationForHost(ctx.db, args),
});

export const hasRole = pluginQuery({
  auth: "actor",
  args: {
    actorUserId: v.string(),
    organizationId: v.string(),
    role: v.optional(v.string()),
    roles: v.optional(v.array(v.string())),
  },
  handler: async (ctx: QueryCtx, { actorUserId, organizationId, role, roles }) =>
    await hasOrganizationRole(ctx.db, omitUndefined({
      actorUserId: actorUserId as Id<"users">,
      organizationId: organizationId as Id<"organizations">,
      role,
      roles,
    })),
});

export const requireRole = pluginQuery({
  auth: "actor",
  args: {
    actorUserId: v.string(),
    organizationId: v.string(),
    role: v.optional(v.string()),
    roles: v.optional(v.array(v.string())),
  },
  handler: async (ctx: QueryCtx, { actorUserId, organizationId, role, roles }) =>
    await requireOrganizationRole(ctx.db, omitUndefined({
      actorUserId: actorUserId as Id<"users">,
      organizationId: organizationId as Id<"organizations">,
      role,
      roles,
    })),
});

export const hasPermission = pluginQuery({
  auth: "actor",
  args: {
    actorUserId: v.string(),
    organizationId: v.string(),
    permission: organizationPermissionValidator,
    rolePermissions: v.optional(rolePermissionsValidator),
  },
  handler: async (ctx: QueryCtx, { actorUserId, organizationId, permission, rolePermissions }) =>
    await hasOrganizationPermission(ctx.db, omitUndefined({
      actorUserId: actorUserId as Id<"users">,
      organizationId: organizationId as Id<"organizations">,
      permission,
      rolePermissions,
    })),
});

export const requirePermission = pluginQuery({
  auth: "actor",
  args: {
    actorUserId: v.string(),
    organizationId: v.string(),
    permission: organizationPermissionValidator,
    rolePermissions: v.optional(rolePermissionsValidator),
  },
  handler: async (ctx: QueryCtx, { actorUserId, organizationId, permission, rolePermissions }) =>
    await requireOrganizationPermission(ctx.db, omitUndefined({
      actorUserId: actorUserId as Id<"users">,
      organizationId: organizationId as Id<"organizations">,
      permission,
      rolePermissions,
    })),
});

export const deleteUserRelations = internalMutation({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, { userId }) =>
    await deleteUserOrganizationRelations(ctx.db, userId as Id<"users">),
});
