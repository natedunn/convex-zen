import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

async function assertAdminActor(
  ctx: { db: { get: (id: Id<"users">) => Promise<{ role?: string } | null> } },
  actorUserId: Id<"users">
): Promise<void> {
  const actor = await ctx.db.get(actorUserId);
  if (!actor) {
    throw new Error("Unauthorized");
  }
  if (actor.role !== "admin") {
    throw new Error("Forbidden");
  }
}

/** List users with cursor-based pagination.
 *
 * paginate() is not available in components, so we use _creationTime as a
 * cursor with .filter() + .take(). The cursor is a stringified _creationTime.
 */
export const listUsers = internalQuery({
  args: {
    actorUserId: v.id("users"),
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await assertAdminActor(ctx, args.actorUserId);

    const limit = args.limit ?? 20;

    let query = ctx.db.query("users").order("asc");

    if (args.cursor) {
      const cursorTime = parseFloat(args.cursor);
      query = query.filter((q) =>
        q.gt(q.field("_creationTime"), cursorTime)
      );
    }

    const rows = await query.take(limit + 1);
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page.at(-1);
    const nextCursor =
      hasMore && last
        ? String(last._creationTime)
        : null;

    return {
      users: page,
      cursor: nextCursor,
      isDone: !hasMore,
    };
  },
});

/** Get a single user by ID (admin view). */
export const getUser = internalQuery({
  args: {
    actorUserId: v.id("users"),
    userId: v.id("users"),
  },
  handler: async (ctx, { actorUserId, userId }) => {
    await assertAdminActor(ctx, actorUserId);
    return await ctx.db.get(userId);
  },
});

/**
 * Ban a user. Sets banned=true, banReason, and optional banExpires.
 * Also invalidates all active sessions.
 */
export const banUser = internalMutation({
  args: {
    actorUserId: v.id("users"),
    userId: v.id("users"),
    reason: v.optional(v.string()),
    expiresAt: v.optional(v.number()), // timestamp; undefined = permanent
  },
  handler: async (ctx, { actorUserId, userId, reason, expiresAt }) => {
    await assertAdminActor(ctx, actorUserId);

    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");

    await ctx.db.patch(userId, {
      banned: true,
      banReason: reason,
      banExpires: expiresAt,
      updatedAt: Date.now(),
    });

    // Invalidate all active sessions
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    for (const session of sessions) {
      await ctx.db.delete(session._id);
    }
  },
});

/** Unban a user. Clears ban fields. */
export const unbanUser = internalMutation({
  args: {
    actorUserId: v.id("users"),
    userId: v.id("users"),
  },
  handler: async (ctx, { actorUserId, userId }) => {
    await assertAdminActor(ctx, actorUserId);

    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");

    await ctx.db.patch(userId, {
      banned: false,
      banReason: undefined,
      banExpires: undefined,
      updatedAt: Date.now(),
    });
  },
});

/** Set a user's role. */
export const setRole = internalMutation({
  args: {
    actorUserId: v.id("users"),
    userId: v.id("users"),
    role: v.string(),
  },
  handler: async (ctx, { actorUserId, userId, role }) => {
    await assertAdminActor(ctx, actorUserId);

    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");

    await ctx.db.patch(userId, {
      role,
      updatedAt: Date.now(),
    });
  },
});

/** Delete a user and all associated data. */
export const deleteUser = internalMutation({
  args: {
    actorUserId: v.id("users"),
    userId: v.id("users"),
  },
  handler: async (ctx, { actorUserId, userId }) => {
    await assertAdminActor(ctx, actorUserId);

    // Delete accounts
    const accounts = await ctx.db
      .query("accounts")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    for (const account of accounts) {
      await ctx.db.delete(account._id);
    }

    // Delete sessions
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    for (const session of sessions) {
      await ctx.db.delete(session._id);
    }

    // Delete the user
    await ctx.db.delete(userId);
  },
});
