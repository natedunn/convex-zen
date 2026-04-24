import { defineTable } from "convex/server";
import { v } from "convex/values";
import { definePluginSchema } from "../../client/index.js";

export const schema = definePluginSchema({
  tables: {
    systemAdmin__users: defineTable({
      userId: v.id("users"),
      role: v.string(),
      banned: v.boolean(),
      banReason: v.optional(v.string()),
      banExpires: v.optional(v.number()),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_userId", ["userId"])
      .index("by_role", ["role"]),
  },
});
