import { defineTable } from "convex/server";
import { v } from "convex/values";
import { definePluginSchema } from "convex-zen";

export const schema = definePluginSchema({
  tables: {
    example__logs: defineTable({
      scope: v.string(),
      level: v.string(),
      message: v.string(),
      actorUserId: v.optional(v.string()),
      tag: v.optional(v.string()),
      createdAt: v.number(),
    }).index("by_scope_createdAt", ["scope", "createdAt"]),
  },
});

export default schema;
