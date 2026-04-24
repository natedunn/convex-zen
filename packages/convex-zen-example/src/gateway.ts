import type {
  GenericDataModel,
  GenericMutationCtx,
  GenericQueryCtx,
} from "convex/server";
import { v } from "convex/values";
import { pluginMutation, pluginQuery } from "convex-zen/component";

const levelValidator = v.union(
  v.literal("debug"),
  v.literal("info"),
  v.literal("warn"),
  v.literal("error")
);

type ExampleLogLevel = "debug" | "info" | "warn" | "error";

type ExampleLogRecord = {
  scope: string;
  level: ExampleLogLevel;
  message: string;
  actorUserId?: string;
  tag?: string;
  createdAt: number;
};

type ExampleLogDoc = ExampleLogRecord & {
  _id: string;
  _creationTime: number;
};

type ExampleLogIndexRangeBuilder = {
  eq(field: "scope", value: string): unknown;
};

type ExampleLogsQueryBuilder = {
  withIndex(
    name: "by_scope_createdAt",
    builder: (query: ExampleLogIndexRangeBuilder) => unknown
  ): {
    order(direction: "asc" | "desc"): {
      take(limit: number): Promise<Array<ExampleLogDoc>>;
    };
  };
};

type ExamplePluginMutationDb = {
  insert(table: "example__logs", value: ExampleLogRecord): Promise<unknown>;
  query(table: "example__logs"): ExampleLogsQueryBuilder;
};

type ExamplePluginQueryDb = {
  query(table: "example__logs"): ExampleLogsQueryBuilder;
};

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
  handler: async (ctx: GenericMutationCtx<GenericDataModel>, args) => {
    const db = ctx.db as unknown as ExamplePluginMutationDb;
    const scope = normalizeScope(args.scope);
    const createdAt = Date.now();
    await db.insert("example__logs", {
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
  handler: async (ctx: GenericQueryCtx<GenericDataModel>, args) => {
    const db = ctx.db as unknown as ExamplePluginQueryDb;
    const scope = normalizeScope(args.scope);
    const limit = Math.max(1, Math.min(args.limit ?? 10, 50));
    const entries = await db
      .query("example__logs")
      .withIndex("by_scope_createdAt", (q) => q.eq("scope", scope))
      .order("desc")
      .take(limit);

    return {
      scope,
      entries: entries.map(
        (entry) => ({
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
