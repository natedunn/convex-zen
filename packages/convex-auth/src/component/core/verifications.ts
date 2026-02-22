import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";
import { generateCode, hashToken } from "../lib/crypto";

/** Max attempts before a verification code is locked. */
const MAX_ATTEMPTS = 10;

/** Email verification TTL: 60 minutes. */
const EMAIL_VERIFICATION_TTL_MS = 60 * 60 * 1000;

/** Password reset TTL: 15 minutes. */
const PASSWORD_RESET_TTL_MS = 15 * 60 * 1000;

/**
 * Create a verification code for a given identifier and type.
 * Any previous verification of the same type is replaced.
 * Returns the raw code (to be sent to the user) and the expiry.
 */
export const create = internalMutation({
  args: {
    identifier: v.string(),
    type: v.union(
      v.literal("email-verification"),
      v.literal("password-reset")
    ),
  },
  handler: async (ctx, { identifier, type }) => {
    const now = Date.now();
    const code = generateCode();
    const codeHash = await hashToken(code);
    const ttl =
      type === "email-verification"
        ? EMAIL_VERIFICATION_TTL_MS
        : PASSWORD_RESET_TTL_MS;
    const expiresAt = now + ttl;

    // Remove any existing verification of this type for this identifier
    const existing = await ctx.db
      .query("verifications")
      .withIndex("by_identifier_type", (q) =>
        q.eq("identifier", identifier).eq("type", type)
      )
      .unique();
    if (existing) {
      await ctx.db.delete(existing._id);
    }

    await ctx.db.insert("verifications", {
      identifier,
      type,
      codeHash,
      expiresAt,
      attempts: 0,
      createdAt: now,
    });

    return { code, expiresAt };
  },
});

/**
 * Get verification record without consuming it.
 */
export const getByIdentifierType = internalQuery({
  args: {
    identifier: v.string(),
    type: v.union(
      v.literal("email-verification"),
      v.literal("password-reset")
    ),
  },
  handler: async (ctx, { identifier, type }) => {
    return await ctx.db
      .query("verifications")
      .withIndex("by_identifier_type", (q) =>
        q.eq("identifier", identifier).eq("type", type)
      )
      .unique();
  },
});

/**
 * Verify a code for an identifier and type.
 * Increments attempt count; invalidates after MAX_ATTEMPTS.
 * Returns status: "valid" | "invalid" | "expired" | "too_many_attempts"
 */
export const verify = internalMutation({
  args: {
    identifier: v.string(),
    type: v.union(
      v.literal("email-verification"),
      v.literal("password-reset")
    ),
    code: v.string(),
  },
  handler: async (ctx, { identifier, type, code }) => {
    const record = await ctx.db
      .query("verifications")
      .withIndex("by_identifier_type", (q) =>
        q.eq("identifier", identifier).eq("type", type)
      )
      .unique();

    if (!record) {
      return { status: "invalid" as const };
    }

    const now = Date.now();

    if (record.expiresAt < now) {
      await ctx.db.delete(record._id);
      return { status: "expired" as const };
    }

    if (record.attempts >= MAX_ATTEMPTS) {
      return { status: "too_many_attempts" as const };
    }

    const codeHash = await hashToken(code);

    if (codeHash !== record.codeHash) {
      // Increment attempts
      await ctx.db.patch(record._id, { attempts: record.attempts + 1 });
      if (record.attempts + 1 >= MAX_ATTEMPTS) {
        return { status: "too_many_attempts" as const };
      }
      return { status: "invalid" as const };
    }

    // Valid — delete the verification (single-use)
    await ctx.db.delete(record._id);
    return { status: "valid" as const };
  },
});

/** Delete a verification record (e.g., after successful use or on cancel). */
export const invalidate = internalMutation({
  args: {
    identifier: v.string(),
    type: v.union(
      v.literal("email-verification"),
      v.literal("password-reset")
    ),
  },
  handler: async (ctx, { identifier, type }) => {
    const record = await ctx.db
      .query("verifications")
      .withIndex("by_identifier_type", (q) =>
        q.eq("identifier", identifier).eq("type", type)
      )
      .unique();
    if (record) {
      await ctx.db.delete(record._id);
    }
  },
});

/**
 * Cleanup expired verifications (intended to be scheduled).
 */
export const cleanup = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    // Collect and delete expired records
    const allVerifications = await ctx.db.query("verifications").collect();
    for (const v of allVerifications) {
      if (v.expiresAt < now) {
        await ctx.db.delete(v._id);
      }
    }
  },
});
