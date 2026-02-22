import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";

/** Window duration: 10 minutes in milliseconds. */
const WINDOW_MS = 10 * 60 * 1000;

/** Max failures before lockout. */
const MAX_FAILURES = 10;

/** Lockout duration: 10 minutes. */
const LOCKOUT_MS = 10 * 60 * 1000;

/**
 * Check if a key is currently rate limited.
 * Returns { limited: true, retryAfter } if locked, { limited: false } otherwise.
 */
export const check = internalQuery({
  args: {
    key: v.string(),
  },
  handler: async (ctx, { key }) => {
    const now = Date.now();
    const record = await ctx.db
      .query("rateLimits")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();

    if (!record) {
      return { limited: false as const };
    }

    // Check hard lockout
    if (record.lockedUntil !== undefined && record.lockedUntil > now) {
      return { limited: true as const, retryAfter: record.lockedUntil - now };
    }

    // Check sliding window count
    const windowAge = now - record.windowStart;
    if (windowAge < WINDOW_MS && record.count >= MAX_FAILURES) {
      return { limited: true as const, retryAfter: WINDOW_MS - windowAge };
    }

    return { limited: false as const };
  },
});

/**
 * Increment failure count for a key. Applies lockout if threshold reached.
 */
export const increment = internalMutation({
  args: {
    key: v.string(),
  },
  handler: async (ctx, { key }) => {
    const now = Date.now();
    const record = await ctx.db
      .query("rateLimits")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();

    if (!record) {
      await ctx.db.insert("rateLimits", {
        key,
        count: 1,
        windowStart: now,
      });
      return;
    }

    const windowAge = now - record.windowStart;
    let newCount: number;
    let windowStart: number;

    if (windowAge >= WINDOW_MS) {
      // New window
      newCount = 1;
      windowStart = now;
    } else {
      newCount = record.count + 1;
      windowStart = record.windowStart;
    }

    const lockedUntil =
      newCount >= MAX_FAILURES ? now + LOCKOUT_MS : record.lockedUntil;

    await ctx.db.patch(record._id, {
      count: newCount,
      windowStart,
      lockedUntil,
    });
  },
});

/**
 * Reset rate limit for a key (called on successful auth).
 */
export const reset = internalMutation({
  args: {
    key: v.string(),
  },
  handler: async (ctx, { key }) => {
    const record = await ctx.db
      .query("rateLimits")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();

    if (record) {
      await ctx.db.delete(record._id);
    }
  },
});
