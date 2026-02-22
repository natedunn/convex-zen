import { v } from "convex/values";
import {
  internalAction,
  internalMutation,
  internalQuery,
} from "../_generated/server";
import { generateToken, hashToken } from "../lib/crypto";
import { internal } from "../lib/internalApi";

/** Session duration: 1 hour. */
const SESSION_DURATION_MS = 60 * 60 * 1000;

/** Absolute max session duration: 12 hours. */
const ABSOLUTE_DURATION_MS = 12 * 60 * 60 * 1000;

/** Extend session when last active > 30 minutes ago. */
const EXTEND_THRESHOLD_MS = 30 * 60 * 1000;

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
  handler: async (ctx, args) => {
    const token = generateToken();
    const tokenHash = await hashToken(token);
    const now = Date.now();

    const sessionDoc: {
      userId: typeof args.userId;
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

    await ctx.db.insert("sessions", sessionDoc);

    return token;
  },
});

/**
 * Get session by raw token. Hashes the token internally before lookup.
 * Returns the session document or null.
 */
export const getByToken = internalQuery({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const tokenHash = await hashToken(token);
    return await ctx.db
      .query("sessions")
      .withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash))
      .unique();
  },
});

/**
 * Validate a session token. Returns user and session info if valid.
 * Schedules session extension if within extend window.
 * Returns null if session is expired or invalid.
 */
export const validate = internalAction({
  args: {
    token: v.string(),
    checkBanned: v.optional(v.boolean()),
  },
  handler: async (ctx, { token, checkBanned }) => {
    const session = await ctx.runQuery(internal.core.sessions.getByToken, {
      token,
    });

    if (!session) {
      return null;
    }

    const now = Date.now();

    // Check both expiry conditions
    if (session.expiresAt < now || session.absoluteExpiresAt < now) {
      await ctx.runMutation(internal.core.sessions.invalidateByHash, {
        tokenHash: session.tokenHash,
      });
      return null;
    }

    // Extend session if within threshold
    if (now - session.lastActiveAt > EXTEND_THRESHOLD_MS) {
      await ctx.runMutation(internal.core.sessions.extend, {
        sessionId: session._id,
      });
    }

    // Check banned status if admin plugin is active
    if (checkBanned) {
      const user = await ctx.runQuery(internal.core.users.getById, {
        userId: session.userId,
      });
      if (user?.banned) {
        const banExpires = user.banExpires;
        if (banExpires === undefined || banExpires > now) {
          return null;
        }
        // Temp ban expired — unban automatically
        await ctx.runMutation(internal.core.users.update, {
          userId: session.userId,
          banned: false,
        });
      }
    }

    return {
      userId: session.userId,
      sessionId: session._id,
    };
  },
});

/** Extend a session's expiry (up to absolute max). */
export const extend = internalMutation({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, { sessionId }) => {
    const session = await ctx.db.get(sessionId);
    if (!session) return;

    const now = Date.now();
    const newExpiresAt = Math.min(
      now + SESSION_DURATION_MS,
      session.absoluteExpiresAt
    );

    await ctx.db.patch(sessionId, {
      expiresAt: newExpiresAt,
      lastActiveAt: now,
    });
  },
});

/** Invalidate a session by its document ID. */
export const invalidate = internalMutation({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, { sessionId }) => {
    await ctx.db.delete(sessionId);
  },
});

/** Invalidate a session by its token hash (used internally). */
export const invalidateByHash = internalMutation({
  args: { tokenHash: v.string() },
  handler: async (ctx, { tokenHash }) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash))
      .unique();
    if (session) {
      await ctx.db.delete(session._id);
    }
  },
});

/** Invalidate a session by raw token. */
export const invalidateByToken = internalMutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const tokenHash = await hashToken(token);
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash))
      .unique();
    if (session) {
      await ctx.db.delete(session._id);
    }
  },
});

/** Invalidate all sessions for a user. */
export const invalidateAll = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    for (const session of sessions) {
      await ctx.db.delete(session._id);
    }
  },
});

/**
 * Cleanup expired sessions (intended to be scheduled).
 * Processes in batches to avoid timeout.
 */
export const cleanup = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const expired = await ctx.db
      .query("sessions")
      .withIndex("by_expiresAt", (q) => q.lt("expiresAt", now))
      .take(100);
    for (const session of expired) {
      await ctx.db.delete(session._id);
    }
  },
});
