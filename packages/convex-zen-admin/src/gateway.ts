import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import type {
  MutationCtx,
  QueryCtx,
} from "../../convex-zen/src/component/_generated/server";
import type { Id } from "../../convex-zen/src/component/_generated/dataModel";
import { pluginMutation, pluginQuery } from "convex-zen/component";
import {
  assertAdminActor,
  banUserByAdmin,
  deleteAdminStateForUser,
  deleteUserByAdmin,
  listUsersForAdmin,
  normalizeAdminRole,
  setUserRoleByAdmin,
  unbanUserByAdmin,
} from "./component";

export const isAdmin = pluginQuery({
  auth: "optionalActor",
  args: {
    adminRole: v.optional(v.string()),
  },
  handler: async (ctx: QueryCtx, { actorUserId, adminRole }) => {
    try {
      await assertAdminActor(ctx.db, actorUserId as Id<"users">, adminRole);
      return true;
    } catch {
      return false;
    }
  },
});

export const listUsers = pluginQuery({
  auth: "actor",
  args: {
    adminRole: v.optional(v.string()),
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  handler: async (
    ctx: QueryCtx,
    {
      actorUserId,
      adminRole,
      limit,
      cursor,
    }
  ) =>
    await listUsersForAdmin(ctx.db, {
      actorUserId: actorUserId as Id<"users">,
      adminRole: normalizeAdminRole(adminRole),
      ...(limit !== undefined ? { limit } : {}),
      ...(cursor !== undefined ? { cursor } : {}),
    }),
});

export const banUser = pluginMutation({
  auth: "actor",
  args: {
    adminRole: v.optional(v.string()),
    userId: v.string(),
    reason: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
  },
  handler: async (
    ctx: MutationCtx,
    {
      actorUserId,
      adminRole,
      userId,
      reason,
      expiresAt,
    }
  ) =>
    await banUserByAdmin(ctx.db, {
      actorUserId: actorUserId as Id<"users">,
      adminRole: normalizeAdminRole(adminRole),
      userId: userId as Id<"users">,
      ...(reason !== undefined ? { reason } : {}),
      ...(expiresAt !== undefined ? { expiresAt } : {}),
    }),
});

export const unbanUser = pluginMutation({
  auth: "actor",
  args: {
    adminRole: v.optional(v.string()),
    userId: v.string(),
  },
  handler: async (
    ctx: MutationCtx,
    {
      actorUserId,
      adminRole,
      userId,
    }
  ) =>
    await unbanUserByAdmin(ctx.db, {
      actorUserId: actorUserId as Id<"users">,
      adminRole: normalizeAdminRole(adminRole),
      userId: userId as Id<"users">,
    }),
});

export const setRole = pluginMutation({
  auth: "actor",
  args: {
    adminRole: v.optional(v.string()),
    userId: v.string(),
    role: v.string(),
  },
  handler: async (
    ctx: MutationCtx,
    {
      actorUserId,
      adminRole,
      userId,
      role,
    }
  ) =>
    await setUserRoleByAdmin(ctx.db, {
      actorUserId: actorUserId as Id<"users">,
      adminRole: normalizeAdminRole(adminRole),
      userId: userId as Id<"users">,
      role,
    }),
});

export const deleteUser = pluginMutation({
  auth: "actor",
  args: {
    adminRole: v.optional(v.string()),
    userId: v.string(),
  },
  handler: async (
    ctx: MutationCtx,
    {
      actorUserId,
      adminRole,
      userId,
    }
  ) =>
    await deleteUserByAdmin(ctx.db, {
      actorUserId: actorUserId as Id<"users">,
      adminRole: normalizeAdminRole(adminRole),
      userId: userId as Id<"users">,
    }),
});

export const deleteUserAdminState = internalMutation({
  args: {
    actorUserId: v.string(),
    adminRole: v.optional(v.string()),
    userId: v.string(),
  },
  handler: async (ctx, { actorUserId, adminRole, userId }) => {
    await assertAdminActor(ctx.db, actorUserId as Id<"users">, adminRole);
    await deleteAdminStateForUser(ctx.db, userId as Id<"users">);
  },
});
