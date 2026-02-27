import { argon2id, argon2Verify } from "hash-wasm";
import { v } from "convex/values";
import { internalMutation, type MutationCtx } from "../_generated/server";
import { internal } from "../lib/internalApi";
import {
  findAccount,
  findUserByEmail,
  findUserById,
  insertAccount,
  insertUser,
  patchUser,
} from "../core/users";
import {
  checkRateLimit,
  incrementRateLimit,
  resetRateLimit,
} from "../lib/rateLimit";
import {
  createVerification,
  verifyVerification,
} from "../core/verifications";
import {
  createSession,
  invalidateAllUserSessions,
} from "../core/sessions";

const MIN_PASSWORD_LENGTH = 12;
const MAX_PASSWORD_LENGTH = 128;

type EmailPasswordCtx = Pick<MutationCtx, "db" | "scheduler">;

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
): Promise<{ status: "verification_required"; verificationCode: string }> {
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
    throw new Error("Email already registered");
  }

  const passwordHash = await hashPassword(password);

  const userId = await insertUser(ctx.db, {
    email: normalizedEmail,
    emailVerified: false,
    name,
    role: defaultRole,
  });
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
    internal.core.verifications.cleanup,
    {}
  );

  return { status: "verification_required" as const, verificationCode: code };
}

export async function signInWithEmailPassword(
  ctx: EmailPasswordCtx,
  args: {
    email: string;
    password: string;
    ipAddress?: string;
    userAgent?: string;
    requireEmailVerified?: boolean;
  }
): Promise<{ sessionToken: string; userId: string }> {
  const { email, password, ipAddress, userAgent, requireEmailVerified } = args;
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

  const account = await findAccount(ctx.db, "credential", normalizedEmail);

  if (!account || !account.passwordHash) {
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

  const user = await findUserById(ctx.db, account.userId);

  if (requireEmailVerified && !user?.emailVerified) {
    throw new Error("Email address not verified");
  }

  if (user?.banned) {
    const now = Date.now();
    if (user.banExpires === undefined || user.banExpires > now) {
      throw new Error(
        `Account banned${user.banReason ? ": " + user.banReason : ""}`
      );
    }
  }

  for (const key of rateLimitKeys) {
    await resetRateLimit(ctx.db, key);
  }

  const sessionToken = await createSession(ctx.db, {
    userId: account.userId,
    ipAddress,
    userAgent,
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

  const user = await findUserByEmail(ctx.db, normalizedEmail);
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
): Promise<{ status: "sent"; resetCode: string | null }> {
  const { email, ipAddress } = args;
  const normalizedEmail = email.toLowerCase();
  const rateLimitKeys = [`reset:email:${normalizedEmail}`];
  if (ipAddress) {
    rateLimitKeys.push(`reset:ip:${ipAddress}`);
  }

  for (const key of rateLimitKeys) {
    const rateCheck = await checkRateLimit(ctx.db, key);
    if (rateCheck.limited) {
      return { status: "sent" as const, resetCode: null };
    }
  }

  for (const key of rateLimitKeys) {
    await incrementRateLimit(ctx.db, key);
  }

  const user = await findUserByEmail(ctx.db, normalizedEmail);
  if (!user) {
    return { status: "sent" as const, resetCode: null };
  }

  const { code, expiresAt } = await createVerification(ctx.db, {
    identifier: normalizedEmail,
    type: "password-reset",
  });

  await ctx.scheduler.runAt(
    expiresAt,
    internal.core.verifications.cleanup,
    {}
  );

  return { status: "sent" as const, resetCode: code };
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

  const account = await findAccount(ctx.db, "credential", normalizedEmail);
  if (!account) {
    throw new Error("Account not found");
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

/** Internal mutation to update password hash on an account. */
export const updatePasswordHash = internalMutation({
  args: {
    accountId: v.id("accounts"),
    passwordHash: v.string(),
  },
  handler: async (ctx, { accountId, passwordHash }) => {
    await ctx.db.patch(accountId, {
      passwordHash,
      updatedAt: Date.now(),
    });
  },
});
