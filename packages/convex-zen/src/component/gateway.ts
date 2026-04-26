/**
 * Public core gateway callable from the host app.
 *
 * Built-in plugins expose their own public gateways under child components.
 */
import { v } from "convex/values";
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
  type DatabaseReader,
} from "./_generated/server.js";
import type { Id } from "./_generated/dataModel.js";
import { oauthProviderConfigValidator } from "./lib/validators.js";
import { omitUndefined } from "./lib/object.js";
import { cleanupExpiredVerifications as cleanupExpiredVerificationRecords } from "./core/verifications.js";
import {
  requestPasswordResetCode,
  resetPasswordWithCode,
  signInWithEmailPassword,
  signUpWithEmailPassword,
  verifyEmailCode,
} from "./providers/emailPassword.js";
import {
  invalidateAllUserSessions,
  invalidateSessionByRawToken,
  validateSessionToken,
  validateSessionTokenReadOnly,
} from "./core/sessions.js";
import {
  findAccount,
  findUserById,
  getAdminStateForUser,
  isAdminStateCurrentlyBanned,
} from "./core/users.js";
import {
  cleanupExpiredOAuthStates as cleanupExpiredOAuthStateRecords,
  consumeOAuthStateRecord,
  finalizeOAuthCallbackForProvider,
  getAuthorizationUrlForProvider,
  handleOAuthCallbackForProvider,
} from "./providers/oauth.js";

async function normalizeUserForAuthRead<T extends { _id: Id<"users"> }>(
  db: { query: DatabaseReader["query"] },
  user: T,
  checkBanned: boolean | undefined
): Promise<T | null> {
  if (!checkBanned) {
    return user;
  }
  const adminState = await getAdminStateForUser(db as DatabaseReader, user._id);
  if (!adminState?.banned) {
    return user;
  }
  const now = Date.now();
  if (isAdminStateCurrentlyBanned(adminState, now)) {
    return null;
  }
  return user;
}

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
    requireVerification: v.optional(v.boolean()),
    checkBanned: v.optional(v.boolean()),
  },
  handler: async (ctx, args) =>
    await signInWithEmailPassword(ctx, {
      ...args,
      requireVerification: args.requireVerification ?? true,
    }),
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
      ...omitUndefined({ checkBanned }),
    });
    if (!session) {
      return null;
    }
    const user = await findUserById(ctx.db, session.userId);
    if (!user) {
      return null;
    }
    return await normalizeUserForAuthRead(ctx.db, user, checkBanned);
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
    return await normalizeUserForAuthRead(ctx.db, user, checkBanned);
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
      options: omitUndefined({
        callbackUrl: args.callbackUrl,
        redirectTo: args.redirectTo,
        errorRedirectTo: args.errorRedirectTo,
        redirectUrl: args.redirectUrl,
      }),
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
    checkBanned: v.optional(v.boolean()),
  },
  handler: async (ctx, args) =>
    await handleOAuthCallbackForProvider(ctx, {
      provider: args.provider,
      code: args.code,
      state: args.state,
      ...omitUndefined({
        callbackUrl: args.callbackUrl,
        redirectTo: args.redirectTo,
        errorRedirectTo: args.errorRedirectTo,
        redirectUrl: args.redirectUrl,
        ipAddress: args.ipAddress,
        userAgent: args.userAgent,
        defaultRole: args.defaultRole,
        checkBanned: args.checkBanned,
      }),
    }),
});

export const cleanupExpiredVerifications = internalMutation({
  args: {},
  handler: async (ctx) => await cleanupExpiredVerificationRecords(ctx.db),
});

export const cleanupExpiredOAuthStates = internalMutation({
  args: {},
  handler: async (ctx) => await cleanupExpiredOAuthStateRecords(ctx.db),
});

export const consumeOAuthState = internalMutation({
  args: { stateHash: v.string() },
  handler: async (ctx, { stateHash }) =>
    await consumeOAuthStateRecord(ctx.db, stateHash),
});

export const getLinkedAccount = internalQuery({
  args: {
    providerId: v.string(),
    accountId: v.string(),
  },
  handler: async (ctx, { providerId, accountId }) =>
    await findAccount(ctx.db, providerId, accountId),
});

export const finalizeOAuthCallback = internalMutation({
  args: {
    providerId: v.string(),
    accountId: v.string(),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    encryptedAccessToken: v.string(),
    encryptedRefreshToken: v.optional(v.string()),
    accessTokenExpiresAt: v.optional(v.number()),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    defaultRole: v.optional(v.string()),
    checkBanned: v.optional(v.boolean()),
  },
  handler: async (ctx, args) =>
    await finalizeOAuthCallbackForProvider(ctx, args),
});
