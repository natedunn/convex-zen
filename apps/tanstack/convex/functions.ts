/**
 * Public-facing auth functions for the test app.
 * The frontend calls these via useAction / useMutation / useQuery.
 */
import { v } from "convex/values";
import { action } from "./_generated/server";
import { auth } from "./auth";

export const signUp = action({
  args: {
    email: v.string(),
    password: v.string(),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await auth.signUp(ctx, args);
  },
});

export const signIn = action({
  args: {
    email: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    return await auth.signIn(ctx, args);
  },
});

export const verifyEmail = action({
  args: {
    email: v.string(),
    code: v.string(),
  },
  handler: async (ctx, args) => {
    return await auth.verifyEmail(ctx, args);
  },
});

export const requestPasswordReset = action({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    return await auth.requestPasswordReset(ctx, args);
  },
});

export const resetPassword = action({
  args: {
    email: v.string(),
    code: v.string(),
    newPassword: v.string(),
  },
  handler: async (ctx, args) => {
    return await auth.resetPassword(ctx, args);
  },
});

export const signOut = action({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    await auth.signOut(ctx, token);
  },
});

export const validateSession = action({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    return await auth.validateSession(ctx, token);
  },
});

export const getOAuthUrl = action({
  args: {
    providerId: v.string(),
    redirectUrl: v.optional(v.string()),
  },
  handler: async (ctx, { providerId, redirectUrl }) => {
    return await auth.getOAuthUrl(ctx, providerId, redirectUrl);
  },
});

export const handleOAuthCallback = action({
  args: {
    providerId: v.string(),
    code: v.string(),
    state: v.string(),
    redirectUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await auth.handleCallback(ctx, args);
  },
});

// Admin functions
export const listUsers = action({
  args: {
    token: v.string(),
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await auth.plugins.admin?.listUsers(ctx, {
      adminToken: args.token,
      limit: args.limit,
      cursor: args.cursor,
    });
  },
});

export const banUser = action({
  args: {
    token: v.string(),
    userId: v.string(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await auth.plugins.admin?.banUser(ctx, {
      adminToken: args.token,
      userId: args.userId,
      reason: args.reason,
    });
  },
});

export const setRole = action({
  args: {
    token: v.string(),
    userId: v.string(),
    role: v.string(),
  },
  handler: async (ctx, args) => {
    return await auth.plugins.admin?.setRole(ctx, {
      adminToken: args.token,
      userId: args.userId,
      role: args.role,
    });
  },
});
