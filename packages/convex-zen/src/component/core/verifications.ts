import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";
import type { DatabaseReader, DatabaseWriter } from "../_generated/server";
import { generateCode, hashToken } from "../lib/crypto";

/** Max attempts before a verification code is locked. */
const MAX_ATTEMPTS = 10;

/** Email verification TTL: 60 minutes. */
const EMAIL_VERIFICATION_TTL_MS = 60 * 60 * 1000;

/** Password reset TTL: 15 minutes. */
const PASSWORD_RESET_TTL_MS = 15 * 60 * 1000;

export type VerificationType = "email-verification" | "password-reset";

export type VerificationStatus =
  | "valid"
  | "invalid"
  | "expired"
  | "too_many_attempts";

export async function createVerification(
  db: DatabaseWriter,
  args: { identifier: string; type: VerificationType }
): Promise<{ code: string; expiresAt: number }> {
  const now = Date.now();
  const code = generateCode();
  const codeHash = await hashToken(code);
  const ttl =
    args.type === "email-verification"
      ? EMAIL_VERIFICATION_TTL_MS
      : PASSWORD_RESET_TTL_MS;
  const expiresAt = now + ttl;

  const existing = await db
    .query("verifications")
    .withIndex("by_identifier_type", (q) =>
      q.eq("identifier", args.identifier).eq("type", args.type)
    )
    .unique();
  if (existing) {
    await db.delete(existing._id);
  }

  await db.insert("verifications", {
    identifier: args.identifier,
    type: args.type,
    codeHash,
    expiresAt,
    attempts: 0,
    createdAt: now,
  });

  return { code, expiresAt };
}

export async function getVerification(
  db: DatabaseReader,
  args: { identifier: string; type: VerificationType }
) {
  return await db
    .query("verifications")
    .withIndex("by_identifier_type", (q) =>
      q.eq("identifier", args.identifier).eq("type", args.type)
    )
    .unique();
}

export async function verifyVerification(
  db: DatabaseWriter,
  args: { identifier: string; type: VerificationType; code: string }
): Promise<{ status: VerificationStatus }> {
  const record = await getVerification(db, {
    identifier: args.identifier,
    type: args.type,
  });

  if (!record) {
    return { status: "invalid" as const };
  }

  const now = Date.now();

  if (record.expiresAt < now) {
    await db.delete(record._id);
    return { status: "expired" as const };
  }

  if (record.attempts >= MAX_ATTEMPTS) {
    return { status: "too_many_attempts" as const };
  }

  const codeHash = await hashToken(args.code);
  if (codeHash !== record.codeHash) {
    await db.patch(record._id, { attempts: record.attempts + 1 });
    if (record.attempts + 1 >= MAX_ATTEMPTS) {
      return { status: "too_many_attempts" as const };
    }
    return { status: "invalid" as const };
  }

  await db.delete(record._id);
  return { status: "valid" as const };
}

export async function invalidateVerification(
  db: DatabaseWriter,
  args: { identifier: string; type: VerificationType }
): Promise<void> {
  const record = await getVerification(db, args);
  if (record) {
    await db.delete(record._id);
  }
}

export async function cleanupExpiredVerifications(
  db: DatabaseWriter
): Promise<void> {
  const now = Date.now();
  const allVerifications = await db.query("verifications").collect();
  for (const verification of allVerifications) {
    if (verification.expiresAt < now) {
      await db.delete(verification._id);
    }
  }
}

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
  handler: async (ctx, { identifier, type }) =>
    await createVerification(ctx.db, { identifier, type }),
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
  handler: async (ctx, { identifier, type }) =>
    await getVerification(ctx.db, { identifier, type }),
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
  handler: async (ctx, { identifier, type, code }) =>
    await verifyVerification(ctx.db, { identifier, type, code }),
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
  handler: async (ctx, { identifier, type }) =>
    await invalidateVerification(ctx.db, { identifier, type }),
});

/**
 * Cleanup expired verifications (intended to be scheduled).
 */
export const cleanup = internalMutation({
  args: {},
  handler: async (ctx) => await cleanupExpiredVerifications(ctx.db),
});
