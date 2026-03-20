import { convexTest } from "convex-test";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import schema from "../src/component/schema";
import { internal } from "../src/component/_generated/api";

const modules = import.meta.glob("../src/component/**/*.*s");
const CONVEX_DIRECT_CALL_WARNING =
  "Convex functions should not directly call other Convex functions.";

async function createUser(
  t: ReturnType<typeof convexTest>,
  email: string,
  opts: { verified?: boolean; role?: string } = {}
) {
  const userId = await t.run(async (ctx) => {
    const now = Date.now();
    const userDoc = {
      email,
      emailVerified: opts.verified ?? true,
      createdAt: now,
      updatedAt: now,
    };

    const id = await ctx.db.insert("users", userDoc);
    if (opts.role !== undefined) {
      await ctx.db.insert("adminUsers", {
        userId: id,
        role: opts.role,
        banned: false,
        createdAt: now,
        updatedAt: now,
      });
    }
    await ctx.db.insert("accounts", {
      userId: id,
      providerId: "credential",
      accountId: email,
      passwordHash: "argon2_placeholder",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    return id;
  });
  return userId;
}

async function getAdminUser(
  t: ReturnType<typeof convexTest>,
  userId: string
) {
  return await t.run((ctx) =>
    ctx.db
      .query("adminUsers")
      .withIndex("by_userId", (q) => q.eq("userId", userId as any))
      .unique()
  );
}

describe("admin plugin", () => {
  let consoleWarnSpy: ReturnType<typeof vi.spyOn> | undefined;

  beforeEach(() => {
    vi.useFakeTimers();
    const originalWarn = console.warn.bind(console);
    consoleWarnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation((message, ...args) => {
        if (
          typeof message === "string" &&
          message.includes(CONVEX_DIRECT_CALL_WARNING)
        ) {
          return;
        }
        originalWarn(message, ...args);
      });
  });

  afterEach(() => {
    vi.useRealTimers();
    consoleWarnSpy?.mockRestore();
    consoleWarnSpy = undefined;
  });

  describe("listUsers", () => {
    it("lists users with pagination", async () => {
      const t = convexTest(schema, modules);
      const adminId = await createUser(t, "admin-list@example.com", {
        role: "admin",
      });

      await createUser(t, "user1@example.com");
      await createUser(t, "user2@example.com");
      await createUser(t, "user3@example.com");

      const result = await t.query(internal.plugins.admin.listUsers, {
        actorUserId: adminId,
        limit: 2,
      }) as { users: unknown[]; cursor: string; isDone: boolean };

      expect(result.users).toHaveLength(2);
      expect(result.isDone).toBe(false);

      // Fetch next page
      const result2 = await t.query(internal.plugins.admin.listUsers, {
        actorUserId: adminId,
        limit: 2,
        cursor: result.cursor,
      }) as { users: unknown[]; isDone: boolean };

      expect(result2.users).toHaveLength(2);
      expect(result2.isDone).toBe(true);
    });

    it("returns all users when limit > count", async () => {
      const t = convexTest(schema, modules);
      const adminId = await createUser(t, "admin-list2@example.com", {
        role: "admin",
      });

      await createUser(t, "a@example.com");
      await createUser(t, "b@example.com");

      const result = await t.query(internal.plugins.admin.listUsers, {
        actorUserId: adminId,
        limit: 100,
      }) as { users: unknown[]; isDone: boolean };

      expect(result.users).toHaveLength(3);
      expect(result.isDone).toBe(true);
    });

    it("rejects non-admin actor for internal listUsers", async () => {
      const t = convexTest(schema, modules);
      const nonAdminId = await createUser(t, "member-list@example.com", {
        role: "user",
      });

      await expect(
        t.query(internal.plugins.admin.listUsers, {
          actorUserId: nonAdminId,
          limit: 10,
        })
      ).rejects.toThrow("Forbidden");
    });

    it("supports custom admin role checks", async () => {
      const t = convexTest(schema, modules);
      const ownerId = await createUser(t, "owner-list@example.com", {
        role: "owner",
      });
      await createUser(t, "member-owner-list@example.com", {
        role: "user",
      });

      await expect(
        t.query(internal.plugins.admin.listUsers, {
          actorUserId: ownerId,
          limit: 5,
        })
      ).rejects.toThrow("Forbidden");

      const result = await t.query(internal.plugins.admin.listUsers, {
        actorUserId: ownerId,
        adminRole: "owner",
        limit: 5,
      }) as { users: unknown[] };
      expect(result.users.length).toBeGreaterThan(0);
    });
  });

  describe("banUser", () => {
    it("bans a user and invalidates their sessions", async () => {
      const t = convexTest(schema, modules);
      const adminId = await createUser(t, "admin-ban1@example.com", {
        role: "admin",
      });
      const userId = await createUser(t, "tobanned@example.com");

      // Create a session for the user
      const token = await t.mutation(internal.core.sessions.create, { userId });

      // Verify session is valid
      const beforeBan = await t.mutation(internal.core.sessions.validate, { token });
      expect(beforeBan).not.toBeNull();

      // Ban the user
      await t.mutation(internal.plugins.admin.banUser, {
        actorUserId: adminId,
        userId,
        reason: "Violating TOS",
      });

      // Session should be gone (invalidated on ban)
      const afterBan = await t.mutation(internal.core.sessions.validate, { token });
      expect(afterBan).toBeNull();

      // User should be marked as banned
      const adminUser = await getAdminUser(t, userId);
      expect(adminUser!.banned).toBe(true);
      expect(adminUser!.banReason).toBe("Violating TOS");
    });

    it("bans a user with expiry (temporary ban)", async () => {
      const t = convexTest(schema, modules);
      const adminId = await createUser(t, "admin-ban2@example.com", {
        role: "admin",
      });
      const userId = await createUser(t, "tempbanned@example.com");

      const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

      await t.mutation(internal.plugins.admin.banUser, {
        actorUserId: adminId,
        userId,
        reason: "Temp violation",
        expiresAt,
      });

      const adminUser = await getAdminUser(t, userId);
      expect(adminUser!.banned).toBe(true);
      expect(adminUser!.banExpires).toBe(expiresAt);
    });

    it("prevents sign-in after ban", async () => {
      const t = convexTest(schema, modules);
      const adminId = await createUser(t, "admin-ban3@example.com", {
        role: "admin",
      });

      await t.mutation(internal.providers.emailPassword.signUp, {
        email: "willbeban@example.com",
        password: "Password123!",
      });

      const user = await t.run(async (ctx) => {
        return ctx.db
          .query("users")
          .withIndex("by_email", (q) => q.eq("email", "willbeban@example.com"))
          .unique();
      });

      // Mark email verified and ban
      await t.run(async (ctx) => {
        await ctx.db.patch(user!._id, { emailVerified: true });
      });

      await t.mutation(internal.plugins.admin.banUser, {
        actorUserId: adminId,
        userId: user!._id,
        reason: "Testing ban",
      });

      await expect(
        t.mutation(internal.providers.emailPassword.signIn, {
          email: "willbeban@example.com",
          password: "Password123!",
        })
      ).rejects.toThrow("Account banned");
    });
  });

  describe("unbanUser", () => {
    it("unbans a user", async () => {
      const t = convexTest(schema, modules);
      const adminId = await createUser(t, "admin-unban1@example.com", {
        role: "admin",
      });
      const userId = await createUser(t, "banned@example.com");

      await t.mutation(internal.plugins.admin.banUser, {
        actorUserId: adminId,
        userId,
        reason: "Temporary",
      });

      await t.mutation(internal.plugins.admin.unbanUser, {
        actorUserId: adminId,
        userId,
      });

      const adminUser = await getAdminUser(t, userId);
      expect(adminUser!.banned).toBe(false);
      expect(adminUser!.banReason).toBeUndefined();
    });

    it("allows sign-in after unban", async () => {
      const t = convexTest(schema, modules);
      const adminId = await createUser(t, "admin-unban2@example.com", {
        role: "admin",
      });

      await t.mutation(internal.providers.emailPassword.signUp, {
        email: "tobounce@example.com",
        password: "Password123!",
      });

      const user = await t.run(async (ctx) => {
        return ctx.db
          .query("users")
          .withIndex("by_email", (q) => q.eq("email", "tobounce@example.com"))
          .unique();
      });

      await t.run(async (ctx) => {
        await ctx.db.patch(user!._id, { emailVerified: true });
      });

      // Ban then unban
      await t.mutation(internal.plugins.admin.banUser, {
        actorUserId: adminId,
        userId: user!._id,
      });
      await t.mutation(internal.plugins.admin.unbanUser, {
        actorUserId: adminId,
        userId: user!._id,
      });

      // Should be able to sign in again
      const result = await t.mutation(internal.providers.emailPassword.signIn, {
        email: "tobounce@example.com",
        password: "Password123!",
      }) as { sessionToken: string };

      expect(result.sessionToken).toBeTruthy();
    });
  });

  describe("setRole", () => {
    it("sets user role", async () => {
      const t = convexTest(schema, modules);
      const adminId = await createUser(t, "admin-role1@example.com", {
        role: "admin",
      });
      const userId = await createUser(t, "roletest@example.com");

      await t.mutation(internal.plugins.admin.setRole, {
        actorUserId: adminId,
        userId,
        role: "admin",
      });

      const adminUser = await getAdminUser(t, userId);
      expect(adminUser!.role).toBe("admin");
    });

    it("changes role from one value to another", async () => {
      const t = convexTest(schema, modules);
      const adminId = await createUser(t, "admin-role2@example.com", {
        role: "admin",
      });
      const userId = await createUser(t, "rolechange@example.com");

      await t.mutation(internal.plugins.admin.setRole, {
        actorUserId: adminId,
        userId,
        role: "moderator",
      });

      await t.mutation(internal.plugins.admin.setRole, {
        actorUserId: adminId,
        userId,
        role: "admin",
      });

      const adminUser = await getAdminUser(t, userId);
      expect(adminUser!.role).toBe("admin");
    });

    it("invalidates all sessions when role is changed", async () => {
      const t = convexTest(schema, modules);
      const adminId = await createUser(t, "admin-role-sessions@example.com", {
        role: "admin",
      });
      const userId = await createUser(t, "role-sessions-user@example.com");

      // Create sessions for the user
      const token1 = await t.mutation(internal.core.sessions.create, { userId });
      const token2 = await t.mutation(internal.core.sessions.create, { userId });

      // Both sessions should be valid before role change
      const before1 = await t.mutation(internal.core.sessions.validate, { token: token1 });
      const before2 = await t.mutation(internal.core.sessions.validate, { token: token2 });
      expect(before1).not.toBeNull();
      expect(before2).not.toBeNull();

      // Change the role
      await t.mutation(internal.plugins.admin.setRole, {
        actorUserId: adminId,
        userId,
        role: "moderator",
      });

      // All sessions should be invalidated after role change
      const after1 = await t.mutation(internal.core.sessions.validate, { token: token1 });
      const after2 = await t.mutation(internal.core.sessions.validate, { token: token2 });
      expect(after1).toBeNull();
      expect(after2).toBeNull();
    });

    it("rejects a banned admin actor", async () => {
      const t = convexTest(schema, modules);
      const adminId = await createUser(t, "banned-admin-role@example.com", {
        role: "admin",
      });
      const userId = await createUser(t, "target-role@example.com");

      // Ban the admin
      await t.run(async (ctx) => {
        const adminRecord = await ctx.db
          .query("adminUsers")
          .withIndex("by_userId", (q) => q.eq("userId", adminId))
          .unique();
        await ctx.db.patch(adminRecord!._id, {
          banned: true,
          banReason: "test",
          updatedAt: Date.now(),
        });
      });

      await expect(
        t.mutation(internal.plugins.admin.setRole, {
          actorUserId: adminId,
          userId,
          role: "moderator",
        })
      ).rejects.toThrow("Unauthorized");
    });
  });

  describe("deleteUser", () => {
    it("deletes user and associated accounts/sessions", async () => {
      const t = convexTest(schema, modules);
      const adminId = await createUser(t, "admin-delete1@example.com", {
        role: "admin",
      });
      const userId = await createUser(t, "todelete@example.com");

      // Create sessions
      await t.mutation(internal.core.sessions.create, { userId });
      await t.mutation(internal.core.sessions.create, { userId });

      await t.mutation(internal.plugins.admin.deleteUser, {
        actorUserId: adminId,
        userId,
      });

      // User should be gone
      const user = await t.run((ctx) => ctx.db.get(userId));
      expect(user).toBeNull();

      // Sessions should be gone
      const sessions = await t.run(async (ctx) => {
        return ctx.db
          .query("sessions")
          .withIndex("by_userId", (q) => q.eq("userId", userId))
          .collect();
      });
      expect(sessions).toHaveLength(0);

      // Accounts should be gone
      const accounts = await t.run(async (ctx) => {
        return ctx.db
          .query("accounts")
          .withIndex("by_userId", (q) => q.eq("userId", userId))
          .collect();
      });
      expect(accounts).toHaveLength(0);
    });

    it("throws on non-existent user", async () => {
      const t = convexTest(schema, modules);
      const adminId = await createUser(t, "admin-delete2@example.com", {
        role: "admin",
      });
      const userId = await createUser(t, "temp@example.com");

      // Delete once
      await t.mutation(internal.plugins.admin.deleteUser, {
        actorUserId: adminId,
        userId,
      });

      // Delete again — should throw
      await expect(
        t.mutation(internal.plugins.admin.deleteUser, {
          actorUserId: adminId,
          userId,
        })
      ).rejects.toThrow();
    });
  });

});
