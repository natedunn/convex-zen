import { argon2id, argon2Verify } from "hash-wasm";
import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";
import { internalMutation, type MutationCtx } from "../_generated/server.js";
import { omitUndefined } from "../lib/object.js";
import {
  findAccount,
  getAdminStateForUser,
  isAdminStateCurrentlyBanned,
  findAccountsByUserId,
  findUserByEmail,
  findUserById,
  insertAccount,
  insertUser,
  patchUser,
  upsertAdminStateForUser,
} from "../core/users.js";
import {
  checkRateLimit,
  incrementRateLimit,
  resetRateLimit,
} from "../lib/rateLimit.js";
import {
  createVerification,
  cleanupExpiredVerifications as cleanupExpiredVerificationRecords,
  verifyVerification,
} from "../core/verifications.js";
import {
  createSession,
  invalidateAllUserSessions,
} from "../core/sessions.js";

const MIN_PASSWORD_LENGTH = 12;
const MAX_PASSWORD_LENGTH = 128;
const cleanupExpiredVerificationsRef = makeFunctionReference<"mutation">(
  "core/gateway:cleanupExpiredVerifications"
);

type EmailPasswordCtx = Pick<MutationCtx, "db" | "scheduler">;
type SignUpSuppressedReason = "email_already_registered";
type PasswordResetSuppressedReason = "email_not_found" | "rate_limited";

async function hashPassword(password: string): Promise<string> {
  return argon2id({
    password,
    salt: crypto.getRandomValues(new Uint8Array(16)),
    parallelism: 1,
    iterations: 2,
    memorySize: 19456, // 19 MB in KB
    hashLength: 32,
    outputType: "encoded", // PHC string — includes salt + params
  });
}

/** Simple email validation — no ReDoS-prone regex. */
function isValidEmail(email: string): boolean {
  if (email.length > 255) return false;
  const atIndex = email.indexOf("@");
  if (atIndex < 1) return false;
  const domain = email.slice(atIndex + 1);
  if (domain.length < 3) return false;
  if (!domain.includes(".")) return false;
  return true;
}

function assertStrongPassword(password: string): void {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(
      `Password must be at least ${MIN_PASSWORD_LENGTH} characters long`
    );
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    throw new Error(
      `Password must be at most ${MAX_PASSWORD_LENGTH} characters long`
    );
  }
}

export async function signUpWithEmailPassword(
  ctx: EmailPasswordCtx,
  args: {
    email: string;
    password: string;
    name?: string;
    ipAddress?: string;
    defaultRole?: string;
  }
): Promise<{
  status: "verification_required";
  verificationCode: string | null;
  suppressedReason: SignUpSuppressedReason | null;
}> {
  const { email, password, name, ipAddress, defaultRole } = args;
  const normalizedEmail = email.toLowerCase();

  if (!isValidEmail(email)) {
    throw new Error("Invalid email address");
  }
  assertStrongPassword(password);

  const rateLimitKeys = [`signup:email:${normalizedEmail}`];
  if (ipAddress) {
    rateLimitKeys.push(`signup:ip:${ipAddress}`);
  }

  for (const key of rateLimitKeys) {
    const rateCheck = await checkRateLimit(ctx.db, key);
    if (rateCheck.limited) {
      throw new Error("Too many requests. Please try again later.");
    }
  }

  const existingUser = await findUserByEmail(ctx.db, normalizedEmail);
  if (existingUser) {
    for (const key of rateLimitKeys) {
      await incrementRateLimit(ctx.db, key);
    }
    // Return the same shape as a successful signup to avoid revealing
    // whether this email address is already registered (email enumeration).
    return {
      status: "verification_required" as const,
      verificationCode: null,
      suppressedReason: "email_already_registered",
    };
  }

  const passwordHash = await hashPassword(password);

  const userId = await insertUser(ctx.db, {
    email: normalizedEmail,
    emailVerified: false,
    ...omitUndefined({ name }),
  });
  if (defaultRole !== undefined) {
    await upsertAdminStateForUser(ctx.db, userId, { role: defaultRole });
  }
  await insertAccount(ctx.db, {
    userId,
    providerId: "credential",
    accountId: normalizedEmail,
    passwordHash,
  });

  const { code, expiresAt } = await createVerification(ctx.db, {
    identifier: normalizedEmail,
    type: "email-verification",
  });

  await ctx.scheduler.runAt(
    expiresAt,
    cleanupExpiredVerificationsRef,
    {}
  );

  return {
    status: "verification_required" as const,
    verificationCode: code,
    suppressedReason: null,
  };
}

export async function signInWithEmailPassword(
  ctx: EmailPasswordCtx,
  args: {
    email: string;
    password: string;
    ipAddress?: string;
    userAgent?: string;
    requireEmailVerified?: boolean;
    checkBanned?: boolean;
  }
): Promise<{ sessionToken: string; userId: string }> {
  const {
    email,
    password,
    ipAddress,
    userAgent,
    requireEmailVerified,
    checkBanned,
  } = args;
  const normalizedEmail = email.toLowerCase();

  const rateLimitKeys: string[] = [];
  if (ipAddress) {
    rateLimitKeys.push(`signin:ip:${ipAddress}`);
  }
  rateLimitKeys.push(`signin:email:${normalizedEmail}`);

  for (const key of rateLimitKeys) {
    const rateCheck = await checkRateLimit(ctx.db, key);
    if (rateCheck.limited) {
      throw new Error("Too many failed attempts. Please try again later.");
    }
  }

  const recordFailure = async () => {
    for (const key of rateLimitKeys) {
      await incrementRateLimit(ctx.db, key);
    }
  };

  let account = await findAccount(ctx.db, "credential", normalizedEmail);
  let existingUser = await findUserByEmail(ctx.db, normalizedEmail);
  let existingAccounts = existingUser
    ? await findAccountsByUserId(ctx.db, existingUser._id)
    : [];

  // Backward-compatible fallback: treat any account with a password hash
  // as credential-capable, even if provider/account IDs differ.
  if (!account) {
    account =
      existingAccounts.find((existingAccount) => existingAccount.passwordHash !== undefined) ??
      null;
  }

  if (!account || !account.passwordHash) {
    if (existingUser) {
      const hasOAuthAccount = existingAccounts.some(
        (existingAccount) =>
          existingAccount.providerId !== "credential" &&
          existingAccount.passwordHash === undefined
      );
      if (hasOAuthAccount) {
        await recordFailure();
        throw new Error("Invalid email or password");
      }
    }
    await recordFailure();
    throw new Error("Invalid email or password");
  }

  const isValid = await argon2Verify({
    password,
    hash: account.passwordHash,
  });

  if (!isValid) {
    await recordFailure();
    throw new Error("Invalid email or password");
  }

  let user = await findUserById(ctx.db, account.userId);
  if (!user) {
    // Self-heal orphaned credential accounts by re-linking to the
    // canonical email user (or creating one if missing).
    const emailUser = await findUserByEmail(ctx.db, normalizedEmail);
    if (emailUser) {
      user = emailUser;
      if (emailUser._id !== account.userId) {
        await ctx.db.patch(account._id, {
          userId: emailUser._id,
          updatedAt: Date.now(),
        });
        account = { ...account, userId: emailUser._id };
      }
    } else {
      const repairedUserId = await insertUser(ctx.db, {
        email: normalizedEmail,
        emailVerified: false,
      });
      await ctx.db.patch(account._id, {
        userId: repairedUserId,
        updatedAt: Date.now(),
      });
      user = await findUserById(ctx.db, repairedUserId);
      account = { ...account, userId: repairedUserId };
    }
  }

  if (requireEmailVerified && !user?.emailVerified) {
    throw new Error("Email address not verified");
  }

  if (checkBanned && user) {
    const adminState = await getAdminStateForUser(ctx.db, user._id);
    if (adminState && isAdminStateCurrentlyBanned(adminState, Date.now())) {
        throw new Error(
          `Account banned${adminState.banReason ? ": " + adminState.banReason : ""}`
        );
    }
  }

  for (const key of rateLimitKeys) {
    await resetRateLimit(ctx.db, key);
  }

  const sessionToken = await createSession(ctx.db, {
    userId: account.userId,
    ...omitUndefined({ ipAddress, userAgent }),
  });

  return { sessionToken, userId: account.userId };
}

export async function verifyEmailCode(
  ctx: EmailPasswordCtx,
  args: { email: string; code: string }
): Promise<{ status: "valid" | "invalid" | "expired" | "too_many_attempts" }> {
  const normalizedEmail = args.email.toLowerCase();

  const result = await verifyVerification(ctx.db, {
    identifier: normalizedEmail,
    type: "email-verification",
    code: args.code,
  });

  if (result.status !== "valid") {
    return result;
  }

  let user = await findUserByEmail(ctx.db, normalizedEmail);
  if (!user) {
    // Backward-compatible fallback: resolve user through credential account
    // when email lookups don't match historical account/user data.
    const credentialAccount = await findAccount(
      ctx.db,
      "credential",
      normalizedEmail
    );
    if (credentialAccount) {
      user = await findUserById(ctx.db, credentialAccount.userId);
      if (!user) {
        const repairedUserId = await insertUser(ctx.db, {
          email: normalizedEmail,
          emailVerified: true,
        });
        await ctx.db.patch(credentialAccount._id, {
          userId: repairedUserId,
          updatedAt: Date.now(),
        });
        user = await findUserById(ctx.db, repairedUserId);
      }
    }
  }

  if (user) {
    await patchUser(ctx.db, user._id, {
      emailVerified: true,
    });
  }

  return { status: "valid" as const };
}

export async function requestPasswordResetCode(
  ctx: EmailPasswordCtx,
  args: { email: string; ipAddress?: string }
): Promise<{
  status: "sent";
  resetCode: string | null;
  suppressedReason: PasswordResetSuppressedReason | null;
}> {
  const { email, ipAddress } = args;
  const normalizedEmail = email.toLowerCase();
  const rateLimitKeys = [`reset:email:${normalizedEmail}`];
  if (ipAddress) {
    rateLimitKeys.push(`reset:ip:${ipAddress}`);
  }

  for (const key of rateLimitKeys) {
    const rateCheck = await checkRateLimit(ctx.db, key);
    if (rateCheck.limited) {
      return {
        status: "sent" as const,
        resetCode: null,
        suppressedReason: "rate_limited",
      };
    }
  }

  for (const key of rateLimitKeys) {
    await incrementRateLimit(ctx.db, key);
  }

  const user = await findUserByEmail(ctx.db, normalizedEmail);
  if (!user) {
    return {
      status: "sent" as const,
      resetCode: null,
      suppressedReason: "email_not_found",
    };
  }

  const { code, expiresAt } = await createVerification(ctx.db, {
    identifier: normalizedEmail,
    type: "password-reset",
  });

  await ctx.scheduler.runAt(
    expiresAt,
    cleanupExpiredVerificationsRef,
    {}
  );

  return {
    status: "sent" as const,
    resetCode: code,
    suppressedReason: null,
  };
}

export async function resetPasswordWithCode(
  ctx: EmailPasswordCtx,
  args: { email: string; code: string; newPassword: string }
): Promise<{ status: "valid" | "invalid" | "expired" | "too_many_attempts" }> {
  const normalizedEmail = args.email.toLowerCase();
  assertStrongPassword(args.newPassword);

  const result = await verifyVerification(ctx.db, {
    identifier: normalizedEmail,
    type: "password-reset",
    code: args.code,
  });

  if (result.status !== "valid") {
    return result;
  }

  const passwordHash = await hashPassword(args.newPassword);

  let account = await findAccount(ctx.db, "credential", normalizedEmail);
  const user = await findUserByEmail(ctx.db, normalizedEmail);
  if (!user) {
    throw new Error("Account not found");
  }

  if (!account) {
    const existingAccounts = await findAccountsByUserId(ctx.db, user._id);
    account =
      existingAccounts.find(
        (existingAccount) => existingAccount.passwordHash !== undefined
      ) ?? null;
  }

  if (!account) {
    await insertAccount(ctx.db, {
      userId: user._id,
      providerId: "credential",
      accountId: normalizedEmail,
      passwordHash,
    });

    await invalidateAllUserSessions(ctx.db, user._id);
    return { status: "valid" as const };
  }

  await ctx.db.patch(account._id, {
    passwordHash,
    updatedAt: Date.now(),
  });

  await invalidateAllUserSessions(ctx.db, account.userId);

  return { status: "valid" as const };
}

/**
 * Sign up with email and password.
 */
export const signUp = internalMutation({
  args: {
    email: v.string(),
    password: v.string(),
    name: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
    defaultRole: v.optional(v.string()),
  },
  handler: async (ctx, args) => await signUpWithEmailPassword(ctx, args),
});

/**
 * Sign in with email and password.
 */
export const signIn = internalMutation({
  args: {
    email: v.string(),
    password: v.string(),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    requireEmailVerified: v.optional(v.boolean()),
    checkBanned: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => await signInWithEmailPassword(ctx, args),
});

/**
 * Verify email address with a verification code.
 */
export const verifyEmail = internalMutation({
  args: {
    email: v.string(),
    code: v.string(),
  },
  handler: async (ctx, args) => await verifyEmailCode(ctx, args),
});

/**
 * Request a password reset code.
 */
export const requestPasswordReset = internalMutation({
  args: {
    email: v.string(),
    ipAddress: v.optional(v.string()),
  },
  handler: async (ctx, args) => await requestPasswordResetCode(ctx, args),
});

/**
 * Reset password using a verification code.
 */
export const resetPassword = internalMutation({
  args: {
    email: v.string(),
    code: v.string(),
    newPassword: v.string(),
  },
  handler: async (ctx, args) => await resetPasswordWithCode(ctx, args),
});

/** Cleanup expired verification records for scheduled email/password flows. */
export const cleanupExpiredVerifications = internalMutation({
  args: {},
  handler: async (ctx) => await cleanupExpiredVerificationRecords(ctx.db),
});
