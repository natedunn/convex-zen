/**
 * Public gateway — the only functions callable from the host app.
 *
 * Functions are exposed as public mutation/query/action entrypoints so they
 * appear in the component API and can be reached via ctx.runMutation /
 * ctx.runQuery / ctx.runAction from the parent Convex backend.
 */
import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { oauthProviderConfigValidator } from "./lib/validators";
import {
  signUpWithEmailPassword,
  signInWithEmailPassword,
  verifyEmailCode,
  requestPasswordResetCode,
  resetPasswordWithCode,
} from "./providers/emailPassword";
import {
  invalidateAllUserSessions,
  invalidateSessionByRawToken,
  validateSessionTokenReadOnly,
  validateSessionToken,
} from "./core/sessions";
import { findUserById } from "./core/users";
import {
  getAuthorizationUrlForProvider,
  handleOAuthCallbackForProvider,
} from "./providers/oauth";
import {
  banUserByAdmin,
  deleteUserByAdmin,
  listUsersForAdmin,
  setUserRoleByAdmin,
  unbanUserByAdmin,
} from "./plugins/admin";
import {
  acceptIncomingOrganizationInvitation,
  acceptOrganizationInvitation,
  addOrganizationDomain,
  cancelOrganizationInvitation,
  checkOrganizationSlugAvailability,
  createOrganizationRole,
  createOrganizationForUser,
  deleteOrganizationByMember,
  deleteOrganizationRole,
  getOrganizationById,
  getOrganizationDomainVerificationChallenge,
  getOrganizationMembershipForActor,
  getOrganizationRoleByActor,
  inviteOrganizationMember,
  declineIncomingOrganizationInvitation,
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
  resolveOrganizationForHost,
  requireOrganizationPermission,
  requireOrganizationRole,
  setOrganizationMemberRole,
  transferOrganizationOwnership,
  updateOrganizationByMember,
  updateOrganizationRole,
  hasOrganizationPermission,
  hasOrganizationRole,
} from "./plugins/organization";

type AdminActorRecord = {
  _id: Id<"users">;
  role?: string;
  banned?: boolean;
  banExpires?: number;
};

type AdminLookupCtx = {
  db: {
    get: (id: Id<"users">) => Promise<AdminActorRecord | null>;
  };
};

function isCurrentlyBanned(actor: AdminActorRecord, now: number): boolean {
  return !!(
    actor.banned &&
    (actor.banExpires === undefined || actor.banExpires > now)
  );
}

function resolveAdminRole(role: string | undefined): string {
  const trimmed = role?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : "admin";
}

function normalizeUserForAuthRead<T extends {
  banned?: boolean;
  banReason?: string;
  banExpires?: number;
}>(user: T, checkBanned: boolean | undefined): T | null {
  if (!checkBanned || !user.banned) {
    return user;
  }
  const now = Date.now();
  const banExpires = user.banExpires;
  if (banExpires === undefined || banExpires > now) {
    return null;
  }
  return {
    ...user,
    banned: false,
    banReason: undefined,
    banExpires: undefined,
  };
}

async function requireAdminActor(
  ctx: AdminLookupCtx,
  actorUserId: string,
  adminRole?: string,
): Promise<Id<"users">> {
  const now = Date.now();
  const adminUser = await ctx.db.get(actorUserId as Id<"users">);
  const requiredRole = resolveAdminRole(adminRole);
  if (!adminUser) {
    throw new Error("Unauthorized");
  }
  if (isCurrentlyBanned(adminUser, now)) {
    throw new Error("Unauthorized");
  }
  if (adminUser.role !== requiredRole) {
    throw new Error("Forbidden");
  }
  return adminUser._id;
}

// ─── Email / Password ──────────────────────────────────────────────────────

export const signUp = mutation({
  args: {
    email: v.string(),
    password: v.string(),
    name: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
    defaultRole: v.optional(v.string()),
  },
  handler: async (ctx, args) => await signUpWithEmailPassword(ctx, args),
});

export const signIn = mutation({
  args: {
    email: v.string(),
    password: v.string(),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    requireEmailVerified: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => await signInWithEmailPassword(ctx, args),
});

export const verifyEmail = mutation({
  args: {
    email: v.string(),
    code: v.string(),
  },
  handler: async (ctx, args) => await verifyEmailCode(ctx, args),
});

export const requestPasswordReset = mutation({
  args: {
    email: v.string(),
    ipAddress: v.optional(v.string()),
  },
  handler: async (ctx, args) => await requestPasswordResetCode(ctx, args),
});

export const resetPassword = mutation({
  args: {
    email: v.string(),
    code: v.string(),
    newPassword: v.string(),
  },
  handler: async (ctx, args) => await resetPasswordWithCode(ctx, args),
});

// ─── Sessions ──────────────────────────────────────────────────────────────

export const validateSession = mutation({
  args: {
    token: v.string(),
    checkBanned: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => await validateSessionToken(ctx.db, args),
});

export const getCurrentUser = query({
  args: {
    token: v.string(),
    checkBanned: v.optional(v.boolean()),
  },
  handler: async (ctx, { token, checkBanned }) => {
    const session = await validateSessionTokenReadOnly(ctx.db, {
      token,
      checkBanned,
    });
    if (!session) {
      return null;
    }
    const user = await findUserById(ctx.db, session.userId);
    if (!user) {
      return null;
    }
    return normalizeUserForAuthRead(user, checkBanned);
  },
});

export const getUserById = query({
  args: {
    userId: v.string(),
    checkBanned: v.optional(v.boolean()),
  },
  handler: async (ctx, { userId, checkBanned }) => {
    const normalizedUserId = userId as Id<"users">;
    const user = await findUserById(ctx.db, normalizedUserId);
    if (!user) {
      return null;
    }
    return normalizeUserForAuthRead(user, checkBanned);
  },
});

export const invalidateSession = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) =>
    await invalidateSessionByRawToken(ctx.db, args.token),
});

export const invalidateAllSessions = mutation({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) =>
    await invalidateAllUserSessions(ctx.db, userId as Id<"users">),
});

// ─── OAuth ─────────────────────────────────────────────────────────────────

export const getAuthorizationUrl = mutation({
  args: {
    provider: oauthProviderConfigValidator,
    callbackUrl: v.optional(v.string()),
    redirectTo: v.optional(v.string()),
    errorRedirectTo: v.optional(v.string()),
    redirectUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) =>
    await getAuthorizationUrlForProvider(ctx, {
      provider: args.provider,
      options: {
        callbackUrl: args.callbackUrl,
        redirectTo: args.redirectTo,
        errorRedirectTo: args.errorRedirectTo,
        redirectUrl: args.redirectUrl,
      },
    }),
});

export const handleCallback = action({
  args: {
    provider: oauthProviderConfigValidator,
    code: v.string(),
    state: v.string(),
    callbackUrl: v.optional(v.string()),
    redirectTo: v.optional(v.string()),
    errorRedirectTo: v.optional(v.string()),
    redirectUrl: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    defaultRole: v.optional(v.string()),
  },
  handler: async (ctx, args) =>
    await handleOAuthCallbackForProvider(ctx, {
      provider: args.provider,
      code: args.code,
      state: args.state,
      callbackUrl: args.callbackUrl,
      redirectTo: args.redirectTo,
      errorRedirectTo: args.errorRedirectTo,
      redirectUrl: args.redirectUrl,
      ipAddress: args.ipAddress,
      userAgent: args.userAgent,
      defaultRole: args.defaultRole,
    }),
});

// ─── Admin ─────────────────────────────────────────────────────────────────

export const adminIsAdmin = query({
  args: {
    actorUserId: v.string(),
    adminRole: v.optional(v.string()),
  },
  handler: async (ctx, { actorUserId, adminRole }) => {
    const actor = await findUserById(ctx.db, actorUserId as Id<"users">);
    if (!actor) {
      return false;
    }
    if (isCurrentlyBanned(actor, Date.now())) {
      return false;
    }
    return actor.role === resolveAdminRole(adminRole);
  },
});

export const adminListUsers = query({
  args: {
    actorUserId: v.string(),
    adminRole: v.optional(v.string()),
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, { actorUserId, adminRole, limit, cursor }) => {
    const actor = await requireAdminActor(ctx, actorUserId, adminRole);

    return await listUsersForAdmin(ctx.db, {
      actorUserId: actor,
      adminRole: resolveAdminRole(adminRole),
      limit,
      cursor,
    });
  },
});

export const adminBanUser = mutation({
  args: {
    actorUserId: v.string(),
    adminRole: v.optional(v.string()),
    userId: v.string(),
    reason: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
  },
  handler: async (ctx, { actorUserId, adminRole, userId, reason, expiresAt }) => {
    const actor = await requireAdminActor(ctx, actorUserId, adminRole);

    return await banUserByAdmin(ctx.db, {
      actorUserId: actor,
      adminRole: resolveAdminRole(adminRole),
      userId: userId as Id<"users">,
      reason,
      expiresAt,
    });
  },
});

export const adminUnbanUser = mutation({
  args: {
    actorUserId: v.string(),
    adminRole: v.optional(v.string()),
    userId: v.string(),
  },
  handler: async (ctx, { actorUserId, adminRole, userId }) => {
    const actor = await requireAdminActor(ctx, actorUserId, adminRole);

    return await unbanUserByAdmin(ctx.db, {
      actorUserId: actor,
      adminRole: resolveAdminRole(adminRole),
      userId: userId as Id<"users">,
    });
  },
});

export const adminSetRole = mutation({
  args: {
    actorUserId: v.string(),
    adminRole: v.optional(v.string()),
    userId: v.string(),
    role: v.string(),
  },
  handler: async (ctx, { actorUserId, adminRole, userId, role }) => {
    const actor = await requireAdminActor(ctx, actorUserId, adminRole);

    return await setUserRoleByAdmin(ctx.db, {
      actorUserId: actor,
      adminRole: resolveAdminRole(adminRole),
      userId: userId as Id<"users">,
      role,
    });
  },
});

export const adminDeleteUser = mutation({
  args: {
    actorUserId: v.string(),
    adminRole: v.optional(v.string()),
    userId: v.string(),
  },
  handler: async (ctx, { actorUserId, adminRole, userId }) => {
    const actor = await requireAdminActor(ctx, actorUserId, adminRole);

    return await deleteUserByAdmin(ctx.db, {
      actorUserId: actor,
      adminRole: resolveAdminRole(adminRole),
      userId: userId as Id<"users">,
    });
  },
});

// ─── Organizations ──────────────────────────────────────────────────────────

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

export const organizationCheckSlug = query({
  args: {
    slug: v.string(),
  },
  handler: async (ctx, { slug }) =>
    await checkOrganizationSlugAvailability(ctx.db, slug),
});

export const organizationCreate = mutation({
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

export const organizationUpdate = mutation({
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

export const organizationDelete = mutation({
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

export const organizationList = query({
  args: {
    actorUserId: v.string(),
  },
  handler: async (ctx, { actorUserId }) =>
    await listOrganizationsForUser(ctx.db, actorUserId as Id<"users">),
});

export const organizationGet = query({
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

export const organizationGetMembership = query({
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

export const organizationListMembers = query({
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

export const organizationInviteMember = mutation({
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

export const organizationListInvitations = query({
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

export const organizationListIncomingInvitations = query({
  args: {
    actorUserId: v.string(),
  },
  handler: async (ctx, { actorUserId }) =>
    await listIncomingOrganizationInvitationsForUser(ctx.db, {
      actorUserId: actorUserId as Id<"users">,
    }),
});

export const organizationAcceptInvitation = mutation({
  args: {
    actorUserId: v.string(),
    token: v.string(),
    rolePermissions: v.optional(rolePermissionsValidator),
  },
  handler: async (ctx, { actorUserId, token, rolePermissions }) =>
    await acceptOrganizationInvitation(ctx.db, {
      actorUserId: actorUserId as Id<"users">,
      token,
      rolePermissions,
    }),
});

export const organizationAcceptIncomingInvitation = mutation({
  args: {
    actorUserId: v.string(),
    invitationId: v.string(),
  },
  handler: async (ctx, { actorUserId, invitationId }) =>
    await acceptIncomingOrganizationInvitation(ctx.db, {
      actorUserId: actorUserId as Id<"users">,
      invitationId: invitationId as Id<"organizationInvitations">,
    }),
});

export const organizationCancelInvitation = mutation({
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

export const organizationDeclineIncomingInvitation = mutation({
  args: {
    actorUserId: v.string(),
    invitationId: v.string(),
  },
  handler: async (ctx, { actorUserId, invitationId }) =>
    await declineIncomingOrganizationInvitation(ctx.db, {
      actorUserId: actorUserId as Id<"users">,
      invitationId: invitationId as Id<"organizationInvitations">,
    }),
});

export const organizationRemoveMember = mutation({
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

export const organizationSetMemberRole = mutation({
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

export const organizationCreateRole = mutation({
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

export const organizationListRoles = query({
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

export const organizationListAvailablePermissions = query({
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

export const organizationGetRole = query({
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

export const organizationUpdateRole = mutation({
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

export const organizationDeleteRole = mutation({
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

export const organizationTransferOwnership = mutation({
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

export const organizationAddDomain = mutation({
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

export const organizationListDomains = query({
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

export const organizationGetDomainVerificationChallenge = query({
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

export const organizationMarkDomainVerified = mutation({
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

export const organizationRemoveDomain = mutation({
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

export const organizationResolveByHost = query({
  args: {
    host: v.string(),
    subdomainSuffix: v.optional(v.string()),
  },
  handler: async (ctx, args) => await resolveOrganizationForHost(ctx.db, args),
});

export const organizationHasRole = query({
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

export const organizationRequireRole = query({
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

export const organizationHasPermission = query({
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

export const organizationRequirePermission = query({
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
