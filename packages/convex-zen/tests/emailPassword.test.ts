import { convexTest } from "convex-test";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import schema from "../src/component/schema";
import { internal } from "../src/component/_generated/api";

const modules = import.meta.glob("../src/component/**/*.*s");

describe("emailPassword", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("signUp", () => {
    it("creates user and returns verification code", async () => {
      const t = convexTest(schema, modules);

      const result = (await t.mutation(internal.providers.emailPassword.signUp, {
        email: "user@example.com",
        password: "SecurePassword123!",
      })) as { status: string; verificationCode: string };

      expect(result.status).toBe("verification_required");
      expect(result.verificationCode).toMatch(/^[A-Z0-9]{8}$/);

      // Verify user was created
      const user = await t.run(async (ctx) => {
        return await ctx.db
          .query("users")
          .withIndex("by_email", (q) => q.eq("email", "user@example.com"))
          .unique();
      });

      expect(user).not.toBeNull();
      expect(user!.emailVerified).toBe(false);
    });

    it("normalizes email to lowercase", async () => {
      const t = convexTest(schema, modules);

      await t.mutation(internal.providers.emailPassword.signUp, {
        email: "User@EXAMPLE.COM",
        password: "SecurePassword123!",
      });

      const user = await t.run(async (ctx) => {
        return await ctx.db
          .query("users")
          .withIndex("by_email", (q) => q.eq("email", "user@example.com"))
          .unique();
      });

      expect(user).not.toBeNull();
    });

    it("rejects invalid email", async () => {
      const t = convexTest(schema, modules);

      await expect(
        t.mutation(internal.providers.emailPassword.signUp, {
          email: "not-an-email",
          password: "SecurePassword123!",
        })
      ).rejects.toThrow("Invalid email address");
    });

    it("rejects duplicate email", async () => {
      const t = convexTest(schema, modules);

      await t.mutation(internal.providers.emailPassword.signUp, {
        email: "dup@example.com",
        password: "Password123!",
      });

      await expect(
        t.mutation(internal.providers.emailPassword.signUp, {
          email: "dup@example.com",
          password: "AnotherPassword123!",
        })
      ).rejects.toThrow("Email already registered");
    });

    it("rejects short passwords", async () => {
      const t = convexTest(schema, modules);

      await expect(
        t.mutation(internal.providers.emailPassword.signUp, {
          email: "shortpw@example.com",
          password: "short123",
        })
      ).rejects.toThrow("Password must be at least 12 characters long");
    });

    it("applies default role for new users when provided", async () => {
      const t = convexTest(schema, modules);

      await t.mutation(internal.providers.emailPassword.signUp, {
        email: "role-default@example.com",
        password: "SecurePassword123!",
        defaultRole: "member",
      });

      const user = await t.run(async (ctx) => {
        return ctx.db
          .query("users")
          .withIndex("by_email", (q) => q.eq("email", "role-default@example.com"))
          .unique();
      });

      expect(user).not.toBeNull();
      expect(user!.role).toBe("member");
    });

    it("applies IP rate limiting", async () => {
      const t = convexTest(schema, modules);

      // Set up locked rate limit record
      await t.run(async (ctx) => {
        await ctx.db.insert("rateLimits", {
          key: "signup:ip:10.0.0.1",
          count: 10,
          windowStart: Date.now(),
          lockedUntil: Date.now() + 10 * 60 * 1000,
        });
      });

      await expect(
        t.mutation(internal.providers.emailPassword.signUp, {
          email: "new@example.com",
          password: "Password123!",
          ipAddress: "10.0.0.1",
        })
      ).rejects.toThrow("Too many requests");
    });
  });

  describe("signIn", () => {
    async function createVerifiedUser(
      t: ReturnType<typeof convexTest>,
      email = "verified@example.com",
      password = "CorrectPassword123!"
    ) {
      await t.mutation(internal.providers.emailPassword.signUp, {
        email,
        password,
      });
      const user = await t.run(async (ctx) => {
        return ctx.db
          .query("users")
          .withIndex("by_email", (q) => q.eq("email", email.toLowerCase()))
          .unique();
      });
      await t.run(async (ctx) => {
        await ctx.db.patch(user!._id, { emailVerified: true });
      });
      return { userId: user!._id };
    }

    it("signs in with correct credentials", async () => {
      const t = convexTest(schema, modules);
      await createVerifiedUser(t);

      const result = (await t.mutation(internal.providers.emailPassword.signIn, {
        email: "verified@example.com",
        password: "CorrectPassword123!",
      })) as { sessionToken: string; userId: string };

      expect(result.sessionToken).toBeTruthy();
      expect(result.userId).toBeTruthy();
    });

    it("rejects wrong password", async () => {
      const t = convexTest(schema, modules);
      await createVerifiedUser(t);

      await expect(
        t.mutation(internal.providers.emailPassword.signIn, {
          email: "verified@example.com",
          password: "WrongPassword!",
        })
      ).rejects.toThrow("Invalid email or password");
    });

    it("rejects non-existent email", async () => {
      const t = convexTest(schema, modules);

      await expect(
        t.mutation(internal.providers.emailPassword.signIn, {
          email: "nobody@example.com",
          password: "SomePassword123!",
        })
      ).rejects.toThrow("Invalid email or password");
    });

    it("rejects banned users", async () => {
      const t = convexTest(schema, modules);
      const { userId } = await createVerifiedUser(t);

      await t.run(async (ctx) => {
        await ctx.db.patch(userId, {
          banned: true,
          banReason: "Violating TOS",
          updatedAt: Date.now(),
        });
      });

      await expect(
        t.mutation(internal.providers.emailPassword.signIn, {
          email: "verified@example.com",
          password: "CorrectPassword123!",
        })
      ).rejects.toThrow("Account banned");
    });

    it("rate limits after 10 failures", async () => {
      const t = convexTest(schema, modules);

      // Set up a locked rate limit record
      await t.run(async (ctx) => {
        await ctx.db.insert("rateLimits", {
          key: "signin:ip:192.168.1.1",
          count: 10,
          windowStart: Date.now(),
          lockedUntil: Date.now() + 10 * 60 * 1000,
        });
      });

      await expect(
        t.mutation(internal.providers.emailPassword.signIn, {
          email: "verified@example.com",
          password: "WrongPassword!",
          ipAddress: "192.168.1.1",
        })
      ).rejects.toThrow("Too many failed attempts");
    });
  });

  describe("verifyEmail", () => {
    it("verifies email with correct code", async () => {
      const t = convexTest(schema, modules);

      const signUpResult = (await t.mutation(internal.providers.emailPassword.signUp,
        {
          email: "toverify@example.com",
          password: "Password123!",
        }
      )) as { verificationCode: string };

      const result = (await t.mutation(internal.providers.emailPassword.verifyEmail,
        {
          email: "toverify@example.com",
          code: signUpResult.verificationCode,
        }
      )) as { status: string };

      expect(result.status).toBe("valid");

      const user = await t.run(async (ctx) => {
        return ctx.db
          .query("users")
          .withIndex("by_email", (q) => q.eq("email", "toverify@example.com"))
          .unique();
      });
      expect(user!.emailVerified).toBe(true);
    });

    it("rejects wrong code", async () => {
      const t = convexTest(schema, modules);

      await t.mutation(internal.providers.emailPassword.signUp, {
        email: "toverify@example.com",
        password: "Password123!",
      });

      const result = (await t.mutation(internal.providers.emailPassword.verifyEmail,
        {
          email: "toverify@example.com",
          code: "WRONGCOD",
        }
      )) as { status: string };

      expect(result.status).toBe("invalid");
    });

    it("rejects expired code", async () => {
      const t = convexTest(schema, modules);

      await t.mutation(internal.providers.emailPassword.signUp, {
        email: "toverify@example.com",
        password: "Password123!",
      });

      // Advance past 60 minute TTL
      vi.advanceTimersByTime(61 * 60 * 1000);

      const result = (await t.mutation(internal.providers.emailPassword.verifyEmail,
        {
          email: "toverify@example.com",
          code: "ANYCODE1",
        }
      )) as { status: string };

      expect(result.status).toBe("expired");
    });

    it("verification code is single-use", async () => {
      const t = convexTest(schema, modules);

      const signUpResult = (await t.mutation(internal.providers.emailPassword.signUp,
        { email: "once@example.com", password: "Password123!" }
      )) as { verificationCode: string };

      // Use the code
      await t.mutation(internal.providers.emailPassword.verifyEmail, {
        email: "once@example.com",
        code: signUpResult.verificationCode,
      });

      // Use it again — should be invalid
      const second = (await t.mutation(internal.providers.emailPassword.verifyEmail,
        { email: "once@example.com", code: signUpResult.verificationCode }
      )) as { status: string };

      expect(second.status).toBe("invalid");
    });
  });

  describe("password reset", () => {
    it("complete reset flow", async () => {
      const t = convexTest(schema, modules);

      // Sign up user
      await t.mutation(internal.providers.emailPassword.signUp, {
        email: "reset@example.com",
        password: "OldPassword123!",
      });

      // Request reset
      const resetResult = (await t.mutation(internal.providers.emailPassword.requestPasswordReset,
        { email: "reset@example.com" }
      )) as { status: string; resetCode: string | null };

      expect(resetResult.status).toBe("sent");
      expect(resetResult.resetCode).toBeTruthy();
      expect(resetResult.resetCode).toMatch(/^[A-Z0-9]{8}$/);

      // Reset password
      const verifyResult = (await t.mutation(internal.providers.emailPassword.resetPassword,
        {
          email: "reset@example.com",
          code: resetResult.resetCode!,
          newPassword: "NewPassword456!",
        }
      )) as { status: string };

      expect(verifyResult.status).toBe("valid");

      // Should be able to sign in with new password
      // First mark email verified
      await t.run(async (ctx) => {
        const user = await ctx.db
          .query("users")
          .withIndex("by_email", (q) => q.eq("email", "reset@example.com"))
          .unique();
        await ctx.db.patch(user!._id, { emailVerified: true });
      });

      const signInResult = (await t.mutation(internal.providers.emailPassword.signIn,
        {
          email: "reset@example.com",
          password: "NewPassword456!",
        }
      )) as { sessionToken: string };

      expect(signInResult.sessionToken).toBeTruthy();
    });

    it("reset code is single-use", async () => {
      const t = convexTest(schema, modules);

      await t.mutation(internal.providers.emailPassword.signUp, {
        email: "reset2@example.com",
        password: "OldPassword123!",
      });

      const resetResult = (await t.mutation(internal.providers.emailPassword.requestPasswordReset,
        { email: "reset2@example.com" }
      )) as { resetCode: string | null };

      const code = resetResult.resetCode!;

      await t.mutation(internal.providers.emailPassword.resetPassword, {
        email: "reset2@example.com",
        code,
        newPassword: "NewPassword456!",
      });

      // Second use — should be invalid
      const secondResult = (await t.mutation(internal.providers.emailPassword.resetPassword,
        {
          email: "reset2@example.com",
          code,
          newPassword: "AnotherPassword789!",
        }
      )) as { status: string };

      expect(secondResult.status).toBe("invalid");
    });

    it("returns sent with no resetCode for non-existent email", async () => {
      const t = convexTest(schema, modules);

      const result = (await t.mutation(internal.providers.emailPassword.requestPasswordReset,
        { email: "nonexistent@example.com" }
      )) as { status: string; resetCode: string | null };

      expect(result.status).toBe("sent");
      expect(result.resetCode).toBeNull();
    });

    it("rejects short new passwords", async () => {
      const t = convexTest(schema, modules);

      await t.mutation(internal.providers.emailPassword.signUp, {
        email: "reset-short@example.com",
        password: "OldPassword123!",
      });
      const resetResult = (await t.mutation(
        internal.providers.emailPassword.requestPasswordReset,
        { email: "reset-short@example.com" }
      )) as { resetCode: string | null };

      await expect(
        t.mutation(internal.providers.emailPassword.resetPassword, {
          email: "reset-short@example.com",
          code: resetResult.resetCode!,
          newPassword: "tiny1234",
        })
      ).rejects.toThrow("Password must be at least 12 characters long");
    });
  });
});
