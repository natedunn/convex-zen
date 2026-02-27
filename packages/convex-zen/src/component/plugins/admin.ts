import { v } from "convex/values";
import { internalMutation, internalQuery, type DatabaseReader, type DatabaseWriter } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { deleteUserWithRelations } from "../core/users";

function normalizeAdminRole(adminRole?: string): string {
  const normalizedRole = adminRole?.trim();
  return normalizedRole && normalizedRole.length > 0
    ? normalizedRole
    : "admin";
}

export async function assertAdminActor(
  db: DatabaseReader,
  actorUserId: Id<"users">,
  adminRole?: string
): Promise<void> {
  const actor = await db.get(actorUserId);
  const requiredRole = normalizeAdminRole(adminRole);
  if (!actor) {
    throw new Error("Unauthorized");
  }
  if (actor.role !== requiredRole) {
    throw new Error("Forbidden");
  }
}

export async function listUsersForAdmin(
  db: DatabaseReader,
  args: {
    actorUserId: Id<"users">;
    adminRole?: string;
    limit?: number;
    cursor?: string;
  }
): Promise<{ users: unknown[]; cursor: string | null; isDone: boolean }> {
  await assertAdminActor(db, args.actorUserId, args.adminRole);

  const limit = args.limit ?? 20;
  let query = db.query("users").order("asc");

  if (args.cursor) {
    const cursorTime = parseFloat(args.cursor);
    query = query.filter((q) => q.gt(q.field("_creationTime"), cursorTime));
  }

  const rows = await query.take(limit + 1);
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page.at(-1);
  const nextCursor = hasMore && last ? String(last._creationTime) : null;

  return {
    users: page,
    cursor: nextCursor,
    isDone: !hasMore,
  };
}

export async function banUserByAdmin(
  db: DatabaseWriter,
  args: {
    actorUserId: Id<"users">;
    adminRole?: string;
    userId: Id<"users">;
    reason?: string;
    expiresAt?: number;
  }
): Promise<void> {
  await assertAdminActor(db, args.actorUserId, args.adminRole);

  const user = await db.get(args.userId);
  if (!user) {
    throw new Error("User not found");
  }

  await db.patch(args.userId, {
    banned: true,
    banReason: args.reason,
    banExpires: args.expiresAt,
    updatedAt: Date.now(),
  });

  const sessions = await db
    .query("sessions")
    .withIndex("by_userId", (q) => q.eq("userId", args.userId))
    .collect();
  for (const session of sessions) {
    await db.delete(session._id);
  }
}

export async function unbanUserByAdmin(
  db: DatabaseWriter,
  args: {
    actorUserId: Id<"users">;
    adminRole?: string;
    userId: Id<"users">;
  }
): Promise<void> {
  await assertAdminActor(db, args.actorUserId, args.adminRole);

  const user = await db.get(args.userId);
  if (!user) {
    throw new Error("User not found");
  }

  await db.patch(args.userId, {
    banned: false,
    banReason: undefined,
    banExpires: undefined,
    updatedAt: Date.now(),
  });
}

export async function setUserRoleByAdmin(
  db: DatabaseWriter,
  args: {
    actorUserId: Id<"users">;
    adminRole?: string;
    userId: Id<"users">;
    role: string;
  }
): Promise<void> {
  await assertAdminActor(db, args.actorUserId, args.adminRole);

  const user = await db.get(args.userId);
  if (!user) {
    throw new Error("User not found");
  }

  await db.patch(args.userId, {
    role: args.role,
    updatedAt: Date.now(),
  });
}

export async function deleteUserByAdmin(
  db: DatabaseWriter,
  args: {
    actorUserId: Id<"users">;
    adminRole?: string;
    userId: Id<"users">;
  }
): Promise<void> {
  await assertAdminActor(db, args.actorUserId, args.adminRole);

  const user = await db.get(args.userId);
  if (!user) {
    throw new Error("User not found");
  }

  await deleteUserWithRelations(db, args.userId);
}

/** List users with cursor-based pagination.
 *
 * paginate() is not available in components, so we use _creationTime as a
 * cursor with .filter() + .take(). The cursor is a stringified _creationTime.
 */
export const listUsers = internalQuery({
  args: {
    actorUserId: v.id("users"),
    adminRole: v.optional(v.string()),
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => await listUsersForAdmin(ctx.db, args),
});

/** Get a single user by ID (admin view). */
export const getUser = internalQuery({
  args: {
    actorUserId: v.id("users"),
    adminRole: v.optional(v.string()),
    userId: v.id("users"),
  },
  handler: async (ctx, { actorUserId, adminRole, userId }) => {
    await assertAdminActor(ctx.db, actorUserId, adminRole);
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
    adminRole: v.optional(v.string()),
    userId: v.id("users"),
    reason: v.optional(v.string()),
    expiresAt: v.optional(v.number()), // timestamp; undefined = permanent
  },
  handler: async (ctx, args) => await banUserByAdmin(ctx.db, args),
});

/** Unban a user. Clears ban fields. */
export const unbanUser = internalMutation({
  args: {
    actorUserId: v.id("users"),
    adminRole: v.optional(v.string()),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => await unbanUserByAdmin(ctx.db, args),
});

/** Set a user's role. */
export const setRole = internalMutation({
  args: {
    actorUserId: v.id("users"),
    adminRole: v.optional(v.string()),
    userId: v.id("users"),
    role: v.string(),
  },
  handler: async (ctx, args) => await setUserRoleByAdmin(ctx.db, args),
});

/** Delete a user and all associated data. */
export const deleteUser = internalMutation({
  args: {
    actorUserId: v.id("users"),
    adminRole: v.optional(v.string()),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => await deleteUserByAdmin(ctx.db, args),
});
