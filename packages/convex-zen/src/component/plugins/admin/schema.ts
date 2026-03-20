import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  adminUsers: defineTable({
    userId: v.string(),
    role: v.string(),
    banned: v.boolean(),
    banReason: v.optional(v.string()),
    banExpires: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_role", ["role"]),
});
