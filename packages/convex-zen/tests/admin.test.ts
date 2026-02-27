import { convexTest } from "convex-test";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import schema from "../src/component/schema";
import { api, internal } from "../src/component/_generated/api";

const modules = import.meta.glob("../src/component/**/*.*s");

async function createUser(
  t: ReturnType<typeof convexTest>,
  email: string,
  opts: { verified?: boolean; role?: string } = {}
) {
  const userId = await t.run(async (ctx) => {
    const userDoc: {
      email: string;
      emailVerified: boolean;
      createdAt: number;
      updatedAt: number;
      role?: string;
    } = {
      email,
      emailVerified: opts.verified ?? true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    if (opts.role !== undefined) {
      userDoc.role = opts.role;
    }

    const id = await ctx.db.insert("users", userDoc);
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

describe("admin plugin", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
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

      const isDefaultAdmin = await t.query(api.gateway.adminIsAdmin, {
        actorUserId: ownerId,
      });
      expect(isDefaultAdmin).toBe(false);

      const isOwnerAdmin = await t.query(api.gateway.adminIsAdmin, {
        actorUserId: ownerId,
        adminRole: "owner",
      });
      expect(isOwnerAdmin).toBe(true);

      const result = await t.query(api.gateway.adminListUsers, {
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
      const user = await t.run((ctx) => ctx.db.get(userId));
      expect(user!.banned).toBe(true);
      expect(user!.banReason).toBe("Violating TOS");
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

      const user = await t.run((ctx) => ctx.db.get(userId));
      expect(user!.banned).toBe(true);
      expect(user!.banExpires).toBe(expiresAt);
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

      const user = await t.run((ctx) => ctx.db.get(userId));
      expect(user!.banned).toBe(false);
      expect(user!.banReason).toBeUndefined();
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

      const user = await t.run((ctx) => ctx.db.get(userId));
      expect(user!.role).toBe("admin");
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

      const user = await t.run((ctx) => ctx.db.get(userId));
      expect(user!.role).toBe("admin");
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

  describe("gateway authorization", () => {
    it("reports admin status for an admin identity", async () => {
      const t = convexTest(schema, modules);
      const adminId = await createUser(t, "admin-is-admin@example.com", {
        role: "admin",
      });

      const result = await t.query(api.gateway.adminIsAdmin, {
        actorUserId: adminId,
      });

      expect(result).toBe(true);
    });

    it("reports false for a non-admin identity", async () => {
      const t = convexTest(schema, modules);
      const userId = await createUser(t, "member-is-admin@example.com", {
        role: "user",
      });

      const result = await t.query(api.gateway.adminIsAdmin, {
        actorUserId: userId,
      });

      expect(result).toBe(false);
    });

    it("reports false for a banned admin identity", async () => {
      const t = convexTest(schema, modules);
      const adminId = await createUser(t, "banned-admin@example.com", {
        role: "admin",
      });

      await t.run(async (ctx) => {
        await ctx.db.patch(adminId, {
          banned: true,
          banReason: "test",
          updatedAt: Date.now(),
        });
      });

      const result = await t.query(api.gateway.adminIsAdmin, {
        actorUserId: adminId,
      });

      expect(result).toBe(false);
    });

    it("requires actor identity", async () => {
      const t = convexTest(schema, modules);
      await createUser(t, "someone@example.com");

      await expect(
        t.query(api.gateway.adminListUsers, {
          limit: 10,
        })
      ).rejects.toThrow(/actorUserId/);
    });

    it("allows admin identity", async () => {
      const t = convexTest(schema, modules);
      const adminId = await createUser(t, "admin@example.com", {
        role: "admin",
      });
      await createUser(t, "member@example.com", { role: "user" });

      const result = (await t.query(api.gateway.adminListUsers, {
        actorUserId: adminId,
        limit: 10,
      })) as { users: Array<{ _id: string }>; isDone: boolean };

      expect(result.users.length).toBeGreaterThan(0);
      expect(result.isDone).toBe(true);
    });

    it("rejects non-admin identity", async () => {
      const t = convexTest(schema, modules);
      const userId = await createUser(t, "member-identity-forbidden@example.com", {
        role: "user",
      });

      await expect(
        t.query(api.gateway.adminListUsers, {
          actorUserId: userId,
          limit: 10,
        })
      ).rejects.toThrow("Forbidden");
    });
  });
});
