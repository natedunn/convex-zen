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
  validateSessionToken,
} from "./core/sessions";
import { findUserById, patchUser } from "./core/users";
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

export const getCurrentUser = mutation({
  args: {
    token: v.string(),
    checkBanned: v.optional(v.boolean()),
  },
  handler: async (ctx, { token, checkBanned }) => {
    const session = await validateSessionToken(ctx.db, {
      token,
      checkBanned,
    });
    if (!session) {
      return null;
    }
    return await findUserById(ctx.db, session.userId);
  },
});

export const getUserById = mutation({
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
    if (!checkBanned || !user.banned) {
      return user;
    }

    const now = Date.now();
    const banExpires = user.banExpires;
    if (banExpires === undefined || banExpires > now) {
      return null;
    }

    await patchUser(ctx.db, normalizedUserId, {
      banned: false,
    });

    return await findUserById(ctx.db, normalizedUserId);
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

export const getAuthorizationUrl = action({
  args: {
    provider: oauthProviderConfigValidator,
    redirectUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) =>
    await getAuthorizationUrlForProvider(ctx, {
      provider: args.provider,
      redirectUrl: args.redirectUrl,
    }),
});

export const handleCallback = action({
  args: {
    provider: oauthProviderConfigValidator,
    code: v.string(),
    state: v.string(),
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
