import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";
import type { DatabaseReader, DatabaseWriter } from "../_generated/server";

/** Window duration: 10 minutes in milliseconds. */
const WINDOW_MS = 10 * 60 * 1000;

/** Max failures before lockout. */
const MAX_FAILURES = 10;

/** Lockout duration: 10 minutes. */
const LOCKOUT_MS = 10 * 60 * 1000;

export async function checkRateLimit(
  db: DatabaseReader,
  key: string
): Promise<
  | { limited: false }
  | { limited: true; retryAfter: number }
> {
  const now = Date.now();
  const record = await db
    .query("rateLimits")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();

  if (!record) {
    return { limited: false as const };
  }

  if (record.lockedUntil !== undefined && record.lockedUntil > now) {
    return { limited: true as const, retryAfter: record.lockedUntil - now };
  }

  const windowAge = now - record.windowStart;
  if (windowAge < WINDOW_MS && record.count >= MAX_FAILURES) {
    return { limited: true as const, retryAfter: WINDOW_MS - windowAge };
  }

  return { limited: false as const };
}

export async function incrementRateLimit(
  db: DatabaseWriter,
  key: string
): Promise<void> {
  const now = Date.now();
  const record = await db
    .query("rateLimits")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();

  if (!record) {
    await db.insert("rateLimits", {
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
    newCount = 1;
    windowStart = now;
  } else {
    newCount = record.count + 1;
    windowStart = record.windowStart;
  }

  const lockedUntil =
    newCount >= MAX_FAILURES ? now + LOCKOUT_MS : record.lockedUntil;

  await db.patch(record._id, {
    count: newCount,
    windowStart,
    lockedUntil,
  });
}

export async function resetRateLimit(
  db: DatabaseWriter,
  key: string
): Promise<void> {
  const record = await db
    .query("rateLimits")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();

  if (record) {
    await db.delete(record._id);
  }
}

/**
 * Check if a key is currently rate limited.
 * Returns { limited: true, retryAfter } if locked, { limited: false } otherwise.
 */
export const check = internalQuery({
  args: {
    key: v.string(),
  },
  handler: async (ctx, { key }) => await checkRateLimit(ctx.db, key),
});

/**
 * Increment failure count for a key. Applies lockout if threshold reached.
 */
export const increment = internalMutation({
  args: {
    key: v.string(),
  },
  handler: async (ctx, { key }) => await incrementRateLimit(ctx.db, key),
});

/**
 * Reset rate limit for a key (called on successful auth).
 */
export const reset = internalMutation({
  args: {
    key: v.string(),
  },
  handler: async (ctx, { key }) => await resetRateLimit(ctx.db, key),
});
