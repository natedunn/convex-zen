import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";
import type { DatabaseReader, DatabaseWriter } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

type UserPatchFields = {
  email?: string;
  emailVerified?: boolean;
  name?: string;
  image?: string;
  role?: string;
  banned?: boolean;
  banReason?: string;
  banExpires?: number;
};

type AccountPatchFields = {
  accessToken?: string;
  refreshToken?: string;
  accessTokenExpiresAt?: number;
};

export async function insertUser(
  db: DatabaseWriter,
  args: {
    email: string;
    emailVerified: boolean;
    name?: string;
    image?: string;
    role?: string;
  }
): Promise<Id<"users">> {
  const now = Date.now();
  const userDoc: {
    email: string;
    emailVerified: boolean;
    createdAt: number;
    updatedAt: number;
    name?: string;
    image?: string;
    role?: string;
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
  if (args.role !== undefined) {
    userDoc.role = args.role;
  }

  return await db.insert("users", userDoc);
}

export async function findUserByEmail(
  db: DatabaseReader,
  email: string
) {
  return await db
    .query("users")
    .withIndex("by_email", (q) => q.eq("email", email))
    .unique();
}

export async function findUserById(
  db: DatabaseReader,
  userId: Id<"users">
) {
  return await db.get(userId);
}

export async function patchUser(
  db: DatabaseWriter,
  userId: Id<"users">,
  fields: UserPatchFields
): Promise<void> {
  const patch: Record<string, unknown> = { updatedAt: Date.now() };
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) {
      patch[key] = value;
    }
  }
  await db.patch(userId, patch);
}

export async function deleteUserWithRelations(
  db: DatabaseWriter,
  userId: Id<"users">
): Promise<void> {
  const accounts = await db
    .query("accounts")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect();
  for (const account of accounts) {
    await db.delete(account._id);
  }

  const sessions = await db
    .query("sessions")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect();
  for (const session of sessions) {
    await db.delete(session._id);
  }

  await db.delete(userId);
}

export async function insertAccount(
  db: DatabaseWriter,
  args: {
    userId: Id<"users">;
    providerId: string;
    accountId: string;
    passwordHash?: string;
    accessToken?: string;
    refreshToken?: string;
    accessTokenExpiresAt?: number;
  }
) {
  const now = Date.now();
  const accountDoc: {
    userId: Id<"users">;
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

  return await db.insert("accounts", accountDoc);
}

export async function findAccount(
  db: DatabaseReader,
  providerId: string,
  accountId: string
) {
  return await db
    .query("accounts")
    .withIndex("by_provider_accountId", (q) =>
      q.eq("providerId", providerId).eq("accountId", accountId)
    )
    .unique();
}

export async function findAccountsByUserId(
  db: DatabaseReader,
  userId: Id<"users">
) {
  return await db
    .query("accounts")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect();
}

export async function patchAccount(
  db: DatabaseWriter,
  accountId: Id<"accounts">,
  fields: AccountPatchFields
): Promise<void> {
  const patch: Record<string, unknown> = { updatedAt: Date.now() };
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) {
      patch[key] = value;
    }
  }
  await db.patch(accountId, patch);
}

/** Create a new user record. Returns the new user's ID. */
export const create = internalMutation({
  args: {
    email: v.string(),
    emailVerified: v.boolean(),
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    role: v.optional(v.string()),
  },
  handler: async (ctx, args) => await insertUser(ctx.db, args),
});

/** Get a user by email address. Returns null if not found. */
export const getByEmail = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, { email }) => await findUserByEmail(ctx.db, email),
});

/** Get a user by ID. Returns null if not found. */
export const getById = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => await findUserById(ctx.db, userId),
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
  handler: async (ctx, { userId, ...fields }) =>
    await patchUser(ctx.db, userId, fields),
});

/** Delete a user and all associated accounts and sessions. */
export const remove = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) =>
    await deleteUserWithRelations(ctx.db, userId),
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
  handler: async (ctx, args) => await insertAccount(ctx.db, args),
});

/** Get an account by provider + accountId. */
export const getAccount = internalQuery({
  args: {
    providerId: v.string(),
    accountId: v.string(),
  },
  handler: async (ctx, { providerId, accountId }) =>
    await findAccount(ctx.db, providerId, accountId),
});

/** Get all accounts for a user. */
export const getAccountsByUserId = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) =>
    await findAccountsByUserId(ctx.db, userId),
});

/** Update an account's tokens. */
export const updateAccount = internalMutation({
  args: {
    accountId: v.id("accounts"),
    accessToken: v.optional(v.string()),
    refreshToken: v.optional(v.string()),
    accessTokenExpiresAt: v.optional(v.number()),
  },
  handler: async (ctx, { accountId, ...fields }) =>
    await patchAccount(ctx.db, accountId, fields),
});
