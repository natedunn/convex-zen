/**
 * Public gateway — the only functions callable from the host app.
 *
 * All functions are `action` (not `internalAction`) so they appear in the
 * component's public API and can be reached via ctx.runAction / ctx.runQuery
 * from the parent Convex backend. They simply delegate to the corresponding
 * internal functions.
 *
 * Internal functions remain `internalAction`/`internalMutation`/`internalQuery`
 * and are only callable from within this component.
 */
import { v } from "convex/values";
import { action } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { internal } from "./lib/internalApi";
import { oauthProviderConfigValidator } from "./lib/validators";

// ─── Email / Password ──────────────────────────────────────────────────────

export const signUp = action({
  args: {
    email: v.string(),
    password: v.string(),
    name: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
  },
  handler: (ctx, args) =>
    ctx.runAction(internal.providers.emailPassword.signUp, args),
});

export const signIn = action({
  args: {
    email: v.string(),
    password: v.string(),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    requireEmailVerified: v.optional(v.boolean()),
  },
  handler: (ctx, args) =>
    ctx.runAction(internal.providers.emailPassword.signIn, args),
});

export const verifyEmail = action({
  args: {
    email: v.string(),
    code: v.string(),
  },
  handler: (ctx, args) =>
    ctx.runAction(internal.providers.emailPassword.verifyEmail, args),
});

export const requestPasswordReset = action({
  args: {
    email: v.string(),
    ipAddress: v.optional(v.string()),
  },
  handler: (ctx, args) =>
    ctx.runAction(internal.providers.emailPassword.requestPasswordReset, args),
});

export const resetPassword = action({
  args: {
    email: v.string(),
    code: v.string(),
    newPassword: v.string(),
  },
  handler: (ctx, args) =>
    ctx.runAction(internal.providers.emailPassword.resetPassword, args),
});

// ─── Sessions ──────────────────────────────────────────────────────────────

export const validateSession = action({
  args: {
    token: v.string(),
    checkBanned: v.optional(v.boolean()),
  },
  handler: (ctx, args) =>
    ctx.runAction(internal.core.sessions.validate, args),
});

export const invalidateSession = action({
  args: { token: v.string() },
  handler: (ctx, args) =>
    ctx.runMutation(internal.core.sessions.invalidateByToken, args),
});

export const invalidateAllSessions = action({
  args: { userId: v.string() },
  handler: (ctx, { userId }) =>
    ctx.runMutation(internal.core.sessions.invalidateAll, {
      userId: userId as Id<"users">,
    }),
});

// ─── OAuth ─────────────────────────────────────────────────────────────────

export const getAuthorizationUrl = action({
  args: {
    provider: oauthProviderConfigValidator,
    redirectUrl: v.optional(v.string()),
  },
  handler: (ctx, args) =>
    ctx.runAction(internal.providers.oauth.getAuthorizationUrl, args),
});

export const handleCallback = action({
  args: {
    provider: oauthProviderConfigValidator,
    code: v.string(),
    state: v.string(),
    redirectUrl: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  },
  handler: (ctx, args) =>
    ctx.runAction(internal.providers.oauth.handleCallback, args),
});

// ─── Admin ─────────────────────────────────────────────────────────────────

export const adminListUsers = action({
  args: {
    adminToken: v.string(),
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, { adminToken, limit, cursor }) => {
    const session = await ctx.runAction(internal.core.sessions.validate, {
      token: adminToken,
      checkBanned: true,
    });
    if (!session) {
      throw new Error("Unauthorized");
    }

    const adminUser = await ctx.runQuery(internal.core.users.getById, {
      userId: session.userId,
    });
    if (!adminUser || adminUser.role !== "admin") {
      throw new Error("Forbidden");
    }

    return ctx.runQuery(internal.plugins.admin.listUsers, {
      actorUserId: session.userId,
      limit,
      cursor,
    });
  },
});

export const adminBanUser = action({
  args: {
    adminToken: v.string(),
    userId: v.string(),
    reason: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
  },
  handler: async (ctx, { adminToken, userId, reason, expiresAt }) => {
    const session = await ctx.runAction(internal.core.sessions.validate, {
      token: adminToken,
      checkBanned: true,
    });
    if (!session) {
      throw new Error("Unauthorized");
    }

    const adminUser = await ctx.runQuery(internal.core.users.getById, {
      userId: session.userId,
    });
    if (!adminUser || adminUser.role !== "admin") {
      throw new Error("Forbidden");
    }

    return ctx.runMutation(internal.plugins.admin.banUser, {
      actorUserId: session.userId,
      userId: userId as Id<"users">,
      reason,
      expiresAt,
    });
  },
});

export const adminUnbanUser = action({
  args: {
    adminToken: v.string(),
    userId: v.string(),
  },
  handler: async (ctx, { adminToken, userId }) => {
    const session = await ctx.runAction(internal.core.sessions.validate, {
      token: adminToken,
      checkBanned: true,
    });
    if (!session) {
      throw new Error("Unauthorized");
    }

    const adminUser = await ctx.runQuery(internal.core.users.getById, {
      userId: session.userId,
    });
    if (!adminUser || adminUser.role !== "admin") {
      throw new Error("Forbidden");
    }

    return ctx.runMutation(internal.plugins.admin.unbanUser, {
      actorUserId: session.userId,
      userId: userId as Id<"users">,
    });
  },
});

export const adminSetRole = action({
  args: {
    adminToken: v.string(),
    userId: v.string(),
    role: v.string(),
  },
  handler: async (ctx, { adminToken, userId, role }) => {
    const session = await ctx.runAction(internal.core.sessions.validate, {
      token: adminToken,
      checkBanned: true,
    });
    if (!session) {
      throw new Error("Unauthorized");
    }

    const adminUser = await ctx.runQuery(internal.core.users.getById, {
      userId: session.userId,
    });
    if (!adminUser || adminUser.role !== "admin") {
      throw new Error("Forbidden");
    }

    return ctx.runMutation(internal.plugins.admin.setRole, {
      actorUserId: session.userId,
      userId: userId as Id<"users">,
      role,
    });
  },
});

export const adminDeleteUser = action({
  args: {
    adminToken: v.string(),
    userId: v.string(),
  },
  handler: async (ctx, { adminToken, userId }) => {
    const session = await ctx.runAction(internal.core.sessions.validate, {
      token: adminToken,
      checkBanned: true,
    });
    if (!session) {
      throw new Error("Unauthorized");
    }

    const adminUser = await ctx.runQuery(internal.core.users.getById, {
      userId: session.userId,
    });
    if (!adminUser || adminUser.role !== "admin") {
      throw new Error("Forbidden");
    }

    return ctx.runMutation(internal.plugins.admin.deleteUser, {
      actorUserId: session.userId,
      userId: userId as Id<"users">,
    });
  },
});
