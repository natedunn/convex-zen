import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";

/** Create a new user record. Returns the new user's ID. */
export const create = internalMutation({
  args: {
    email: v.string(),
    emailVerified: v.boolean(),
    name: v.optional(v.string()),
    image: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const userDoc: {
      email: string;
      emailVerified: boolean;
      createdAt: number;
      updatedAt: number;
      name?: string;
      image?: string;
    } = {
      email: args.email,
      emailVerified: args.emailVerified,
      createdAt: now,
      updatedAt: now,
    };
    if (args.name !== undefined) {
      userDoc.name = args.name;
    }
    if (args.image !== undefined) {
      userDoc.image = args.image;
    }

    return await ctx.db.insert("users", userDoc);
  },
});

/** Get a user by email address. Returns null if not found. */
export const getByEmail = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    return await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();
  },
});

/** Get a user by ID. Returns null if not found. */
export const getById = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    return await ctx.db.get(userId);
  },
});

/** Update mutable fields on a user. */
export const update = internalMutation({
  args: {
    userId: v.id("users"),
    email: v.optional(v.string()),
    emailVerified: v.optional(v.boolean()),
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    role: v.optional(v.string()),
    banned: v.optional(v.boolean()),
    banReason: v.optional(v.string()),
    banExpires: v.optional(v.number()),
  },
  handler: async (ctx, { userId, ...fields }) => {
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) {
        patch[key] = value;
      }
    }
    await ctx.db.patch(userId, patch);
  },
});

/** Delete a user and all associated accounts and sessions. */
export const remove = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    // Delete accounts
    const accounts = await ctx.db
      .query("accounts")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    for (const account of accounts) {
      await ctx.db.delete(account._id);
    }

    // Delete sessions
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    for (const session of sessions) {
      await ctx.db.delete(session._id);
    }

    // Delete user
    await ctx.db.delete(userId);
  },
});

/** Create an account entry for a user. */
export const createAccount = internalMutation({
  args: {
    userId: v.id("users"),
    providerId: v.string(),
    accountId: v.string(),
    passwordHash: v.optional(v.string()),
    accessToken: v.optional(v.string()),
    refreshToken: v.optional(v.string()),
    accessTokenExpiresAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const accountDoc: {
      userId: typeof args.userId;
      providerId: string;
      accountId: string;
      createdAt: number;
      updatedAt: number;
      passwordHash?: string;
      accessToken?: string;
      refreshToken?: string;
      accessTokenExpiresAt?: number;
    } = {
      userId: args.userId,
      providerId: args.providerId,
      accountId: args.accountId,
      createdAt: now,
      updatedAt: now,
    };
    if (args.passwordHash !== undefined) {
      accountDoc.passwordHash = args.passwordHash;
    }
    if (args.accessToken !== undefined) {
      accountDoc.accessToken = args.accessToken;
    }
    if (args.refreshToken !== undefined) {
      accountDoc.refreshToken = args.refreshToken;
    }
    if (args.accessTokenExpiresAt !== undefined) {
      accountDoc.accessTokenExpiresAt = args.accessTokenExpiresAt;
    }

    return await ctx.db.insert("accounts", accountDoc);
  },
});

/** Get an account by provider + accountId. */
export const getAccount = internalQuery({
  args: {
    providerId: v.string(),
    accountId: v.string(),
  },
  handler: async (ctx, { providerId, accountId }) => {
    return await ctx.db
      .query("accounts")
      .withIndex("by_provider_accountId", (q) =>
        q.eq("providerId", providerId).eq("accountId", accountId)
      )
      .unique();
  },
});

/** Get all accounts for a user. */
export const getAccountsByUserId = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("accounts")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
  },
});

/** Update an account's tokens. */
export const updateAccount = internalMutation({
  args: {
    accountId: v.id("accounts"),
    accessToken: v.optional(v.string()),
    refreshToken: v.optional(v.string()),
    accessTokenExpiresAt: v.optional(v.number()),
  },
  handler: async (ctx, { accountId, ...fields }) => {
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) {
        patch[key] = value;
      }
    }
    await ctx.db.patch(accountId, patch);
  },
});
