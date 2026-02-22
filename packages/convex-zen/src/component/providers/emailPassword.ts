import { argon2id, argon2Verify } from "hash-wasm";
import { v } from "convex/values";
import { internalAction, internalMutation } from "../_generated/server";
import { internal } from "../lib/internalApi";

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

/**
 * Sign up with email and password.
 *
 * Returns the verification code so the host app (via ConvexAuth client)
 * can send the email. Functions cannot be passed as Convex args.
 *
 * Flow:
 * 1. Validate email
 * 2. Check IP rate limit
 * 3. Check email not already registered
 * 4. Hash password with Argon2id
 * 5. Create user + account
 * 6. Generate verification code
 * 7. Return { status: "verification_required", verificationCode }
 */
export const signUp = internalAction({
  args: {
    email: v.string(),
    password: v.string(),
    name: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { email, password, name, ipAddress } = args;

    // 1. Validate email
    if (!isValidEmail(email)) {
      throw new Error("Invalid email address");
    }

    // 2. Check IP rate limit
    if (ipAddress) {
      const key = `signup:ip:${ipAddress}`;
      const rateCheck = await ctx.runQuery(internal.lib.rateLimit.check, {
        key,
      });
      if (rateCheck.limited) {
        throw new Error("Too many requests. Please try again later.");
      }
    }

    // 3. Check email not already registered
    const existingUser = await ctx.runQuery(internal.core.users.getByEmail, {
      email: email.toLowerCase(),
    });
    if (existingUser) {
      // Increment rate limit to avoid timing-based email enumeration
      if (ipAddress) {
        await ctx.runMutation(internal.lib.rateLimit.increment, {
          key: `signup:ip:${ipAddress}`,
        });
      }
      throw new Error("Email already registered");
    }

    // 4. Hash password with Argon2id
    const passwordHash = await hashPassword(password);

    // 5. Create user + account
    const userId = await ctx.runMutation(internal.core.users.create, {
      email: email.toLowerCase(),
      emailVerified: false,
      name,
    });
    await ctx.runMutation(internal.core.users.createAccount, {
      userId,
      providerId: "credential",
      accountId: email.toLowerCase(),
      passwordHash,
    });

    // 6. Generate verification code (returned to caller for email sending)
    const { code, expiresAt } = await ctx.runMutation(
      internal.core.verifications.create,
      {
        identifier: email.toLowerCase(),
        type: "email-verification",
      }
    );

    // Schedule cleanup at expiry
    await ctx.scheduler.runAt(
      expiresAt,
      internal.core.verifications.cleanup,
      {}
    );

    return { status: "verification_required" as const, verificationCode: code };
  },
});

/**
 * Sign in with email and password.
 *
 * Flow:
 * 1. Check rate limits (IP + email)
 * 2. Look up account by email
 * 3. Verify Argon2id hash
 * 4. Check banned status
 * 5. Create session
 * 6. Return { sessionToken, userId }
 */
export const signIn = internalAction({
  args: {
    email: v.string(),
    password: v.string(),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    requireEmailVerified: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { email, password, ipAddress, userAgent, requireEmailVerified } =
      args;
    const normalizedEmail = email.toLowerCase();

    // 1. Check rate limits
    const rateLimitKeys: string[] = [];
    if (ipAddress) rateLimitKeys.push(`signin:ip:${ipAddress}`);
    rateLimitKeys.push(`signin:email:${normalizedEmail}`);

    for (const key of rateLimitKeys) {
      const rateCheck = await ctx.runQuery(internal.lib.rateLimit.check, {
        key,
      });
      if (rateCheck.limited) {
        throw new Error("Too many failed attempts. Please try again later.");
      }
    }

    // Helper to record failure
    const recordFailure = async () => {
      for (const key of rateLimitKeys) {
        await ctx.runMutation(internal.lib.rateLimit.increment, { key });
      }
    };

    // 2. Look up account by email
    const account = await ctx.runQuery(internal.core.users.getAccount, {
      providerId: "credential",
      accountId: normalizedEmail,
    });

    if (!account || !account.passwordHash) {
      await recordFailure();
      throw new Error("Invalid email or password");
    }

    // 3. Verify Argon2id hash
    const isValid = await argon2Verify({
      password,
      hash: account.passwordHash,
    });

    if (!isValid) {
      await recordFailure();
      throw new Error("Invalid email or password");
    }

    // 4. Check email verified if required
    const user = await ctx.runQuery(internal.core.users.getById, {
      userId: account.userId,
    });

    if (requireEmailVerified && !user?.emailVerified) {
      throw new Error("Email address not verified");
    }

    // 4b. Check banned status
    if (user?.banned) {
      const now = Date.now();
      if (user.banExpires === undefined || user.banExpires > now) {
        throw new Error(
          `Account banned${user.banReason ? ": " + user.banReason : ""}`
        );
      }
    }

    // 5. Reset rate limits on success
    for (const key of rateLimitKeys) {
      await ctx.runMutation(internal.lib.rateLimit.reset, { key });
    }

    // 6. Create session
    const sessionToken = await ctx.runMutation(internal.core.sessions.create, {
      userId: account.userId,
      ipAddress,
      userAgent,
    });

    return { sessionToken, userId: account.userId };
  },
});

/**
 * Verify email address with a verification code.
 */
export const verifyEmail = internalAction({
  args: {
    email: v.string(),
    code: v.string(),
  },
  handler: async (ctx, { email, code }) => {
    const normalizedEmail = email.toLowerCase();

    const result = await ctx.runMutation(internal.core.verifications.verify, {
      identifier: normalizedEmail,
      type: "email-verification",
      code,
    });

    if (result.status !== "valid") {
      return result;
    }

    // Mark user as verified
    const user = await ctx.runQuery(internal.core.users.getByEmail, {
      email: normalizedEmail,
    });
    if (user) {
      await ctx.runMutation(internal.core.users.update, {
        userId: user._id,
        emailVerified: true,
      });
    }

    return { status: "valid" as const };
  },
});

/**
 * Request a password reset code.
 * Returns the reset code so the host app can send the email.
 * Always returns { status: "sent" } to prevent email enumeration.
 * Returns resetCode only when a real user was found.
 */
export const requestPasswordReset = internalAction({
  args: {
    email: v.string(),
    ipAddress: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { email, ipAddress } = args;
    const normalizedEmail = email.toLowerCase();

    // Rate limit
    if (ipAddress) {
      const key = `reset:ip:${ipAddress}`;
      const rateCheck = await ctx.runQuery(internal.lib.rateLimit.check, {
        key,
      });
      if (rateCheck.limited) {
        // Don't reveal if email exists; return success silently
        return { status: "sent" as const, resetCode: null };
      }
      await ctx.runMutation(internal.lib.rateLimit.increment, { key });
    }

    const user = await ctx.runQuery(internal.core.users.getByEmail, {
      email: normalizedEmail,
    });

    if (!user) {
      // Always return success to prevent email enumeration
      return { status: "sent" as const, resetCode: null };
    }

    const { code, expiresAt } = await ctx.runMutation(
      internal.core.verifications.create,
      {
        identifier: normalizedEmail,
        type: "password-reset",
      }
    );

    await ctx.scheduler.runAt(
      expiresAt,
      internal.core.verifications.cleanup,
      {}
    );

    return { status: "sent" as const, resetCode: code };
  },
});

/**
 * Reset password using a verification code.
 */
export const resetPassword = internalAction({
  args: {
    email: v.string(),
    code: v.string(),
    newPassword: v.string(),
  },
  handler: async (ctx, { email, code, newPassword }) => {
    const normalizedEmail = email.toLowerCase();

    const result = await ctx.runMutation(internal.core.verifications.verify, {
      identifier: normalizedEmail,
      type: "password-reset",
      code,
    });

    if (result.status !== "valid") {
      return result;
    }

    // Hash new password
    const passwordHash = await hashPassword(newPassword);

    // Update account password hash
    const account = await ctx.runQuery(internal.core.users.getAccount, {
      providerId: "credential",
      accountId: normalizedEmail,
    });

    if (!account) {
      throw new Error("Account not found");
    }

    await ctx.runMutation(internal.providers.emailPassword.updatePasswordHash, {
      accountId: account._id,
      passwordHash,
    });

    // Invalidate all sessions (force re-login after password reset)
    await ctx.runMutation(internal.core.sessions.invalidateAll, {
      userId: account.userId,
    });

    return { status: "valid" as const };
  },
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
