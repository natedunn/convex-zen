import { v } from "convex/values";
import { mutation, query } from "../../_generated/server";
import type { Id } from "../../_generated/dataModel";
import {
  assertAdminActor,
  banUserByAdmin,
  deleteUserByAdmin,
  listUsersForAdmin,
  setUserRoleByAdmin,
  unbanUserByAdmin,
} from "../admin";

function resolveAdminRole(role: string | undefined): string {
  const trimmed = role?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : "admin";
}

export const isAdmin = query({
  args: {
    actorUserId: v.string(),
    adminRole: v.optional(v.string()),
  },
  handler: async (ctx, { actorUserId, adminRole }) => {
    try {
      await assertAdminActor(ctx.db, actorUserId as Id<"users">, adminRole);
      return true;
    } catch {
      return false;
    }
  },
});

export const listUsers = query({
  args: {
    actorUserId: v.string(),
    adminRole: v.optional(v.string()),
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, { actorUserId, adminRole, limit, cursor }) =>
    await listUsersForAdmin(ctx.db, {
      actorUserId: actorUserId as Id<"users">,
      adminRole: resolveAdminRole(adminRole),
      limit,
      cursor,
    }),
});

export const banUser = mutation({
  args: {
    actorUserId: v.string(),
    adminRole: v.optional(v.string()),
    userId: v.string(),
    reason: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
  },
  handler: async (ctx, { actorUserId, adminRole, userId, reason, expiresAt }) =>
    await banUserByAdmin(ctx.db, {
      actorUserId: actorUserId as Id<"users">,
      adminRole: resolveAdminRole(adminRole),
      userId: userId as Id<"users">,
      reason,
      expiresAt,
    }),
});

export const unbanUser = mutation({
  args: {
    actorUserId: v.string(),
    adminRole: v.optional(v.string()),
    userId: v.string(),
  },
  handler: async (ctx, { actorUserId, adminRole, userId }) =>
    await unbanUserByAdmin(ctx.db, {
      actorUserId: actorUserId as Id<"users">,
      adminRole: resolveAdminRole(adminRole),
      userId: userId as Id<"users">,
    }),
});

export const setRole = mutation({
  args: {
    actorUserId: v.string(),
    adminRole: v.optional(v.string()),
    userId: v.string(),
    role: v.string(),
  },
  handler: async (ctx, { actorUserId, adminRole, userId, role }) =>
    await setUserRoleByAdmin(ctx.db, {
      actorUserId: actorUserId as Id<"users">,
      adminRole: resolveAdminRole(adminRole),
      userId: userId as Id<"users">,
      role,
    }),
});

export const deleteUser = mutation({
  args: {
    actorUserId: v.string(),
    adminRole: v.optional(v.string()),
    userId: v.string(),
  },
  handler: async (ctx, { actorUserId, adminRole, userId }) =>
    await deleteUserByAdmin(ctx.db, {
      actorUserId: actorUserId as Id<"users">,
      adminRole: resolveAdminRole(adminRole),
      userId: userId as Id<"users">,
    }),
});
