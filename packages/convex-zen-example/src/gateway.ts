import { v } from "convex/values";
import { pluginMutation, pluginQuery } from "convex-zen/component";

const levelValidator = v.union(
  v.literal("debug"),
  v.literal("info"),
  v.literal("warn"),
  v.literal("error")
);

function normalizeScope(scope: string | undefined): string {
  const normalized = scope?.trim();
  return normalized && normalized.length > 0 ? normalized : "general";
}

export const log = pluginMutation({
  auth: "actor",
  args: {
    actorUserId: v.string(),
    scope: v.optional(v.string()),
    level: levelValidator,
    message: v.string(),
    tag: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const scope = normalizeScope(args.scope);
    const createdAt = Date.now();
    await ctx.db.insert("exampleLogs", {
      scope,
      level: args.level,
      message: args.message.trim(),
      createdAt,
      ...(args.actorUserId !== undefined
        ? { actorUserId: args.actorUserId }
        : {}),
      ...(args.tag?.trim() ? { tag: args.tag.trim() } : {}),
    });
    return {
      ok: true,
      scope,
      level: args.level,
      message: args.message.trim(),
      createdAt,
    };
  },
});

export const listLogs = pluginQuery({
  auth: "public",
  args: {
    scope: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const scope = normalizeScope(args.scope);
    const limit = Math.max(1, Math.min(args.limit ?? 10, 50));
    const entries = await ctx.db
      .query("exampleLogs")
      .withIndex("by_scope_createdAt", (q) => q.eq("scope", scope))
      .order("desc")
      .take(limit);

    return {
      scope,
      entries: entries.map(
        (entry: {
          message: string;
          level: string;
          actorUserId?: string;
          tag?: string;
          createdAt: number;
        }) => ({
          message: entry.message,
          level: entry.level,
          actorUserId: entry.actorUserId,
          tag: entry.tag,
          createdAt: entry.createdAt,
        })
      ),
    };
  },
});
