import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  type DatabaseReader,
  type DatabaseWriter,
} from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { generateToken, hashToken } from "../lib/crypto";

/** Session duration: 24 hours. */
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000;

/** Absolute max session duration: 14 days. */
const ABSOLUTE_DURATION_MS = 14 * 24 * 60 * 60 * 1000;

/** Extend session when last active > 30 minutes ago. */
const EXTEND_THRESHOLD_MS = 30 * 60 * 1000;

export async function createSession(
  db: DatabaseWriter,
  args: {
    userId: Id<"users">;
    ipAddress?: string;
    userAgent?: string;
  }
): Promise<string> {
  const token = generateToken();
  const tokenHash = await hashToken(token);
  const now = Date.now();

  const sessionDoc: {
    userId: Id<"users">;
    tokenHash: string;
    expiresAt: number;
    absoluteExpiresAt: number;
    lastActiveAt: number;
    createdAt: number;
    ipAddress?: string;
    userAgent?: string;
  } = {
    userId: args.userId,
    tokenHash,
    expiresAt: now + SESSION_DURATION_MS,
    absoluteExpiresAt: now + ABSOLUTE_DURATION_MS,
    lastActiveAt: now,
    createdAt: now,
  };

  if (args.ipAddress !== undefined) {
    sessionDoc.ipAddress = args.ipAddress;
  }
  if (args.userAgent !== undefined) {
    sessionDoc.userAgent = args.userAgent;
  }

  await db.insert("sessions", sessionDoc);
  return token;
}

export async function getSessionByToken(
  db: DatabaseReader,
  token: string
) {
  const tokenHash = await hashToken(token);
  return await db
    .query("sessions")
    .withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash))
    .unique();
}

export async function extendSessionRecord(
  db: DatabaseWriter,
  sessionId: Id<"sessions">
): Promise<void> {
  const session = await db.get(sessionId);
  if (!session) {
    return;
  }

  const now = Date.now();
  const newExpiresAt = Math.min(
    now + SESSION_DURATION_MS,
    session.absoluteExpiresAt
  );

  await db.patch(sessionId, {
    expiresAt: newExpiresAt,
    lastActiveAt: now,
  });
}

export async function invalidateSessionById(
  db: DatabaseWriter,
  sessionId: Id<"sessions">
): Promise<void> {
  await db.delete(sessionId);
}

export async function invalidateSessionByHash(
  db: DatabaseWriter,
  tokenHash: string
): Promise<void> {
  const session = await db
    .query("sessions")
    .withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash))
    .unique();
  if (session) {
    await db.delete(session._id);
  }
}

export async function invalidateSessionByRawToken(
  db: DatabaseWriter,
  token: string
): Promise<void> {
  const tokenHash = await hashToken(token);
  await invalidateSessionByHash(db, tokenHash);
}

export async function invalidateAllUserSessions(
  db: DatabaseWriter,
  userId: Id<"users">
): Promise<void> {
  const sessions = await db
    .query("sessions")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect();
  for (const session of sessions) {
    await db.delete(session._id);
  }
}

export async function validateSessionToken(
  db: DatabaseWriter,
  args: {
    token: string;
    checkBanned?: boolean;
  }
): Promise<{ userId: Id<"users">; sessionId: Id<"sessions"> } | null> {
  const session = await getSessionByToken(db, args.token);
  if (!session) {
    return null;
  }

  const now = Date.now();

  if (session.expiresAt < now || session.absoluteExpiresAt < now) {
    await invalidateSessionByHash(db, session.tokenHash);
    return null;
  }

  if (now - session.lastActiveAt > EXTEND_THRESHOLD_MS) {
    await extendSessionRecord(db, session._id);
  }

  if (args.checkBanned) {
    const user = await db.get(session.userId);
    if (user?.banned) {
      const banExpires = user.banExpires;
      if (banExpires === undefined || banExpires > now) {
        return null;
      }
      await db.patch(session.userId, {
        banned: false,
        updatedAt: now,
      });
    }
  }

  return {
    userId: session.userId,
    sessionId: session._id,
  };
}

export async function cleanupExpiredSessions(
  db: DatabaseWriter
): Promise<void> {
  const now = Date.now();
  const expired = await db
    .query("sessions")
    .withIndex("by_expiresAt", (q) => q.lt("expiresAt", now))
    .take(100);
  for (const session of expired) {
    await db.delete(session._id);
  }
}

/**
 * Create a new session. Returns the raw session token (never stored).
 * The caller is responsible for delivering this token to the client
 * (e.g., via HttpOnly cookie).
 */
export const create = internalMutation({
  args: {
    userId: v.id("users"),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  },
  handler: async (ctx, args) => await createSession(ctx.db, args),
});

/**
 * Get session by raw token. Hashes the token internally before lookup.
 * Returns the session document or null.
 */
export const getByToken = internalQuery({
  args: { token: v.string() },
  handler: async (ctx, { token }) => await getSessionByToken(ctx.db, token),
});

/**
 * Validate a session token. Returns user and session info if valid.
 * Schedules session extension if within extend window.
 * Returns null if session is expired or invalid.
 */
export const validate = internalMutation({
  args: {
    token: v.string(),
    checkBanned: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => await validateSessionToken(ctx.db, args),
});

/** Extend a session's expiry (up to absolute max). */
export const extend = internalMutation({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, { sessionId }) => await extendSessionRecord(ctx.db, sessionId),
});

/** Invalidate a session by its document ID. */
export const invalidate = internalMutation({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, { sessionId }) => await invalidateSessionById(ctx.db, sessionId),
});

/** Invalidate a session by its token hash (used internally). */
export const invalidateByHash = internalMutation({
  args: { tokenHash: v.string() },
  handler: async (ctx, { tokenHash }) =>
    await invalidateSessionByHash(ctx.db, tokenHash),
});

/** Invalidate a session by raw token. */
export const invalidateByToken = internalMutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => await invalidateSessionByRawToken(ctx.db, token),
});

/** Invalidate all sessions for a user. */
export const invalidateAll = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => await invalidateAllUserSessions(ctx.db, userId),
});

/**
 * Cleanup expired sessions (intended to be scheduled).
 * Processes in batches to avoid timeout.
 */
export const cleanup = internalMutation({
  args: {},
  handler: async (ctx) => await cleanupExpiredSessions(ctx.db),
});
