import { convexTest } from "convex-test";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import schema from "../src/component/schema";
import { internal } from "../src/component/_generated/api";

const modules = import.meta.glob("../src/component/**/*.*s");

describe("sessions", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("create and validate a session", async () => {
    const t = convexTest(schema, modules);

    // Create a user first
    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "test@example.com",
        emailVerified: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    // Create session
    const token = await t.mutation(internal.core.sessions.create, {
      userId,
      ipAddress: "127.0.0.1",
      userAgent: "TestAgent/1.0",
    });

    expect(token).toBeTruthy();
    expect(typeof token).toBe("string");
    expect(token.length).toBe(64); // 32 bytes = 64 hex chars

    // Validate session
    const result = await t.mutation(internal.core.sessions.validate, {
      token,
    });

    expect(result).not.toBeNull();
    expect(result!.userId).toBe(userId);
    expect(result!.sessionId).toBeTruthy();
  });

  it("invalid token returns null", async () => {
    const t = convexTest(schema, modules);

    const result = await t.mutation(internal.core.sessions.validate, {
      token: "invalid-token-that-does-not-exist",
    });

    expect(result).toBeNull();
  });

  it("expired session returns null and is cleaned up", async () => {
    const t = convexTest(schema, modules);

    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "test@example.com",
        emailVerified: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const token = await t.mutation(internal.core.sessions.create, { userId });

    // Advance time past session expiry (24 hours + 1 ms)
    vi.advanceTimersByTime(24 * 60 * 60 * 1000 + 1);

    const result = await t.mutation(internal.core.sessions.validate, { token });
    expect(result).toBeNull();
  });

  it("session extends when last active > 30min ago", async () => {
    const t = convexTest(schema, modules);

    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "test@example.com",
        emailVerified: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const token = await t.mutation(internal.core.sessions.create, { userId });

    // Initial validate
    const initialResult = await t.mutation(internal.core.sessions.validate, { token });
    const sessionId = initialResult!.sessionId;

    // Get initial expiresAt
    const initialSession = await t.run((ctx) => ctx.db.get(sessionId));
    const initialExpiresAt = initialSession!.expiresAt;

    // Advance 35 minutes (past extend threshold of 30min)
    vi.advanceTimersByTime(35 * 60 * 1000);

    // Validate again — should trigger extension
    await t.mutation(internal.core.sessions.validate, { token });

    // Check that expiresAt increased
    const extendedSession = await t.run((ctx) => ctx.db.get(sessionId));
    expect(extendedSession!.expiresAt).toBeGreaterThan(initialExpiresAt);
  });

  it("session does NOT extend past absoluteExpiresAt", async () => {
    const t = convexTest(schema, modules);
    const now = Date.now();

    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "test@example.com",
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
      });
    });

    // Create a session whose absoluteExpiresAt is only 20 minutes away
    const absoluteExpiry = now + 20 * 60 * 1000;
    const sessionId = await t.run(async (ctx) => {
      return await ctx.db.insert("sessions", {
        userId,
        tokenHash: "test-hash-for-cap-test",
        expiresAt: now + 60 * 60 * 1000,       // 1h from now
        absoluteExpiresAt: absoluteExpiry,        // only 20min from now
        lastActiveAt: now - 31 * 60 * 1000,      // last active 31min ago (triggers extend)
        createdAt: now,
      });
    });

    // Extend the session — should be capped at absoluteExpiresAt
    await t.mutation(internal.core.sessions.extend, { sessionId });

    const extendedSession = await t.run((ctx) => ctx.db.get(sessionId));
    // expiresAt should not exceed absoluteExpiresAt
    expect(extendedSession!.expiresAt).toBeLessThanOrEqual(absoluteExpiry);
  });

  it("invalidate removes session", async () => {
    const t = convexTest(schema, modules);

    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "test@example.com",
        emailVerified: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const token = await t.mutation(internal.core.sessions.create, { userId });

    // Confirm valid
    const before = await t.mutation(internal.core.sessions.validate, { token });
    expect(before).not.toBeNull();

    // Invalidate by token
    await t.mutation(internal.core.sessions.invalidateByToken, { token });

    // Should be gone
    const after = await t.mutation(internal.core.sessions.validate, { token });
    expect(after).toBeNull();
  });

  it("invalidateAll removes all sessions for a user", async () => {
    const t = convexTest(schema, modules);

    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "test@example.com",
        emailVerified: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    // Create 3 sessions
    const token1 = await t.mutation(internal.core.sessions.create, { userId });
    const token2 = await t.mutation(internal.core.sessions.create, { userId });
    const token3 = await t.mutation(internal.core.sessions.create, { userId });

    await t.mutation(internal.core.sessions.invalidateAll, { userId });

    const [r1, r2, r3] = await Promise.all([
      t.mutation(internal.core.sessions.validate, { token: token1 }),
      t.mutation(internal.core.sessions.validate, { token: token2 }),
      t.mutation(internal.core.sessions.validate, { token: token3 }),
    ]);

    expect(r1).toBeNull();
    expect(r2).toBeNull();
    expect(r3).toBeNull();
  });

  it("banned user session returns null when checkBanned=true", async () => {
    const t = convexTest(schema, modules);

    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "banned@example.com",
        emailVerified: true,
        banned: true,
        banReason: "Test ban",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    const token = await t.mutation(internal.core.sessions.create, { userId });

    const result = await t.mutation(internal.core.sessions.validate, {
      token,
      checkBanned: true,
    });

    expect(result).toBeNull();
  });

  it("banned user with expired ban is unbanned automatically", async () => {
    const t = convexTest(schema, modules);

    const now = Date.now();
    const userId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        email: "banned@example.com",
        emailVerified: true,
        banned: true,
        banReason: "Temp ban",
        banExpires: now - 1000, // Already expired
        createdAt: now,
        updatedAt: now,
      });
    });

    const token = await t.mutation(internal.core.sessions.create, { userId });

    const result = await t.mutation(internal.core.sessions.validate, {
      token,
      checkBanned: true,
    });

    // Should succeed (ban expired)
    expect(result).not.toBeNull();
    expect(result!.userId).toBe(userId);

    // User should be unbanned
    const user = await t.run((ctx) => ctx.db.get(userId));
    expect(user!.banned).toBe(false);
  });
});
