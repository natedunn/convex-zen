import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  exampleLogs: defineTable({
    scope: v.string(),
    level: v.string(),
    message: v.string(),
    actorUserId: v.optional(v.string()),
    tag: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_scope_createdAt", ["scope", "createdAt"]),
});
