import type { FunctionArgs, FunctionReference } from "convex/server";
import type { TanStackStartAuthApiPluginFactory } from "./tanstack-start";
import type {
  TanStackAuthPluginFunctionKind,
  TanStackAuthPluginMeta,
} from "./tanstack-start-plugin-meta";
import { toKebabCase } from "./tanstack-start-plugin-meta";

type MutationRef = FunctionReference<"mutation", "public">;
type QueryRef = FunctionReference<"query", "public">;
type UnknownRecord = Record<string, unknown>;

export interface TanStackStartAdminApiPluginConvexFunctions {
  listUsers: QueryRef;
  banUser: MutationRef;
  setRole: MutationRef;
  unbanUser: MutationRef;
  deleteUser: MutationRef;
}

export interface TanStackStartAdminApiPluginOptions {
  /**
   * Optional explicit Convex function refs.
   * If omitted, refs are auto-resolved from
   * `createTanStackAuthServer({ convexFunctions })`
   * using standard generated names.
   */
  convexFunctions?: Partial<TanStackStartAdminApiPluginConvexFunctions>;
  routePrefix?: string;
}

export const ADMIN_API_PLUGIN_ID = "admin" as const;

export const REQUIRED_ADMIN_CONVEX_FUNCTIONS = [
  "listUsers",
  "banUser",
  "setRole",
  "unbanUser",
  "deleteUser",
] as const;

type RequiredAdminConvexFunctionName =
  (typeof REQUIRED_ADMIN_CONVEX_FUNCTIONS)[number];

function readFunctionRef<
  T extends FunctionReference<"query" | "mutation" | "action", "public">,
>(
  value: unknown
): T | null {
  if (!value || (typeof value !== "object" && typeof value !== "function")) {
    return null;
  }
  return value as T;
}

function resolveRequiredConvexFunction(
  explicit: unknown,
  fallback: unknown,
  functionName: RequiredAdminConvexFunctionName
): FunctionReference<"query" | "mutation", "public"> {
  const resolved =
    readFunctionRef<FunctionReference<"query" | "mutation", "public">>(
      explicit
    ) ??
    readFunctionRef<FunctionReference<"query" | "mutation", "public">>(
      fallback
    );
  if (!resolved) {
    throw new Error(
      `adminApiPlugin could not resolve "${functionName}" convex function. ` +
        "Expose standard generated refs on createTanStackAuthServer({ convexFunctions }) or pass convexFunctions explicitly."
    );
  }
  return resolved;
}

function resolveAdminConvexFunctions(
  options: TanStackStartAdminApiPluginOptions | undefined,
  convexFunctionRefs: Record<string, unknown> | undefined
): TanStackStartAdminApiPluginConvexFunctions {
  const refs = convexFunctionRefs ?? {};
  const adminGroup = readMember(refs, "admin");
  const pluginAdminGroup = readMember(readMember(refs, "plugin"), "admin");
  const fromAnyAdminGroup = (name: string): unknown =>
    readMember(refs, name) ??
    readMember(adminGroup, name) ??
    readMember(pluginAdminGroup, name);
  const explicitActions = options?.convexFunctions;
  const resolved: TanStackStartAdminApiPluginConvexFunctions = {
    listUsers: resolveRequiredConvexFunction(
      explicitActions?.listUsers,
      fromAnyAdminGroup("listUsers"),
      "listUsers"
    ) as QueryRef,
    banUser: resolveRequiredConvexFunction(
      explicitActions?.banUser,
      fromAnyAdminGroup("banUser"),
      "banUser"
    ) as MutationRef,
    setRole: resolveRequiredConvexFunction(
      explicitActions?.setRole,
      fromAnyAdminGroup("setRole"),
      "setRole"
    ) as MutationRef,
    unbanUser: resolveRequiredConvexFunction(
      explicitActions?.unbanUser,
      fromAnyAdminGroup("unbanUser"),
      "unbanUser"
    ) as MutationRef,
    deleteUser: resolveRequiredConvexFunction(
      explicitActions?.deleteUser,
      fromAnyAdminGroup("deleteUser"),
      "deleteUser"
    ) as MutationRef,
  };
  return resolved;
}

function normalizeRoutePrefix(prefix: string): string {
  const trimmed = prefix.trim().replace(/^\/+|\/+$/g, "");
  return trimmed.length > 0 ? trimmed : "admin";
}

function isRecord(value: unknown): value is UnknownRecord {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function parseListUsersArgs(value: unknown): {
  limit?: number;
  cursor?: string;
} | null {
  if (value === null || value === undefined) {
    return {};
  }
  if (!isRecord(value)) {
    return null;
  }
  const args: { limit?: number; cursor?: string } = {};
  if (value.limit !== undefined) {
    if (typeof value.limit !== "number") {
      return null;
    }
    args.limit = value.limit;
  }
  if (value.cursor !== undefined) {
    if (typeof value.cursor !== "string") {
      return null;
    }
    args.cursor = value.cursor;
  }
  return args;
}

function parseBanUserArgs(value: unknown): {
  userId: string;
  reason?: string;
  expiresAt?: number;
} | null {
  if (!isRecord(value) || typeof value.userId !== "string") {
    return null;
  }
  const args: { userId: string; reason?: string; expiresAt?: number } = {
    userId: value.userId,
  };
  if (value.reason !== undefined) {
    if (typeof value.reason !== "string") {
      return null;
    }
    args.reason = value.reason;
  }
  if (value.expiresAt !== undefined) {
    if (typeof value.expiresAt !== "number") {
      return null;
    }
    args.expiresAt = value.expiresAt;
  }
  return args;
}

function parseSetRoleArgs(value: unknown): { userId: string; role: string } | null {
  if (
    !isRecord(value) ||
    typeof value.userId !== "string" ||
    typeof value.role !== "string"
  ) {
    return null;
  }
  return {
    userId: value.userId,
    role: value.role,
  };
}

function parseSingleUserIdArgs(value: unknown): { userId: string } | null {
  if (!isRecord(value) || typeof value.userId !== "string") {
    return null;
  }
  return { userId: value.userId };
}

function parsePluginArgs(value: unknown): Record<string, unknown> | null {
  if (value === null || value === undefined) {
    return {};
  }
  if (!isRecord(value)) {
    return null;
  }
  return value;
}

/**
 * Add admin auth API routes to TanStack Start handler.
 *
 * Endpoints:
 * - POST `/api/auth/admin/list-users`
 * - POST `/api/auth/admin/ban-user`
 * - POST `/api/auth/admin/set-role`
 * - POST `/api/auth/admin/unban-user`
 * - POST `/api/auth/admin/delete-user`
 */
export function adminApiPlugin(
  options: TanStackStartAdminApiPluginOptions = {}
): TanStackStartAuthApiPluginFactory {
  const routePrefix = normalizeRoutePrefix(options.routePrefix ?? "admin");

  return {
    id: ADMIN_API_PLUGIN_ID,
    create: ({ fetchers, convexFunctions }) => {
      const resolvedFunctions = resolveAdminConvexFunctions(
        options,
        convexFunctions
      );
      return {
        id: ADMIN_API_PLUGIN_ID,
        handle: async (context) => {
          const actionPrefix = `${routePrefix}/`;
          if (!context.action.startsWith(actionPrefix)) {
            return null;
          }
          if (context.method !== "POST") {
            return context.json({ error: "Method not allowed" }, 405);
          }

          const adminAction = context.action.slice(actionPrefix.length);
          const payload = await context.readJson();

          if (adminAction === "list-users") {
            const args = parseListUsersArgs(payload);
            if (!args) {
              return context.json({ error: "Invalid request body" }, 400);
            }
            const result = await fetchers.fetchAuthQuery(
              resolvedFunctions.listUsers,
              args as FunctionArgs<typeof resolvedFunctions.listUsers>
            );
            return context.json(result);
          }

          if (adminAction === "ban-user") {
            const args = parseBanUserArgs(payload);
            if (!args) {
              return context.json({ error: "Invalid request body" }, 400);
            }
            const result = await fetchers.fetchAuthMutation(
              resolvedFunctions.banUser,
              args as FunctionArgs<typeof resolvedFunctions.banUser>
            );
            return context.json(result);
          }

          if (adminAction === "set-role") {
            const args = parseSetRoleArgs(payload);
            if (!args) {
              return context.json({ error: "Invalid request body" }, 400);
            }
            const result = await fetchers.fetchAuthMutation(
              resolvedFunctions.setRole,
              args as FunctionArgs<typeof resolvedFunctions.setRole>
            );
            return context.json(result);
          }

          if (adminAction === "unban-user") {
            const args = parseSingleUserIdArgs(payload);
            if (!args) {
              return context.json({ error: "Invalid request body" }, 400);
            }
            const result = await fetchers.fetchAuthMutation(
              resolvedFunctions.unbanUser,
              args as FunctionArgs<typeof resolvedFunctions.unbanUser>
            );
            return context.json(result);
          }

          if (adminAction === "delete-user") {
            const args = parseSingleUserIdArgs(payload);
            if (!args) {
              return context.json({ error: "Invalid request body" }, 400);
            }
            const result = await fetchers.fetchAuthMutation(
              resolvedFunctions.deleteUser,
              args as FunctionArgs<typeof resolvedFunctions.deleteUser>
            );
            return context.json(result);
          }

          return null;
        },
      };
    },
  };
}

export const PLUGIN_API_PLUGIN_ID = "plugin" as const;

export interface TanStackStartPluginApiPluginOptions {
  pluginMeta: TanStackAuthPluginMeta;
  routePrefix?: string;
}

type PluginRouteEntry = {
  kind: TanStackAuthPluginFunctionKind;
  ref: FunctionReference<"query" | "mutation" | "action", "public">;
};

function normalizePluginRoutePrefix(prefix: string): string {
  const trimmed = prefix.trim().replace(/^\/+|\/+$/g, "");
  return trimmed.length > 0 ? trimmed : "plugin";
}

function readMember(source: unknown, key: string): unknown {
  if (
    source === null ||
    (typeof source !== "object" && typeof source !== "function")
  ) {
    return undefined;
  }
  return (source as Record<string, unknown>)[key];
}

function resolvePluginRouteEntries(
  pluginMeta: TanStackAuthPluginMeta,
  convexFunctions: Record<string, unknown> | undefined
): Map<string, PluginRouteEntry> {
  const entries = new Map<string, PluginRouteEntry>();
  const pluginRoot = readMember(convexFunctions, "plugin");

  for (const [pluginName, pluginFunctions] of Object.entries(pluginMeta)) {
    for (const [functionName, functionKind] of Object.entries(pluginFunctions)) {
      const routeKey = `${toKebabCase(pluginName)}/${toKebabCase(functionName)}`;
      if (entries.has(routeKey)) {
        throw new Error(
          `pluginApiPlugin found duplicate route mapping for "${routeKey}".`
        );
      }

      const functionRefCandidate = readMember(
        readMember(pluginRoot, pluginName),
        functionName
      );
      const functionRef = readFunctionRef<
        FunctionReference<"query" | "mutation" | "action", "public">
      >(functionRefCandidate);
      if (!functionRef) {
        throw new Error(
          `pluginApiPlugin could not resolve "convexFunctions.plugin.${pluginName}.${functionName}".`
        );
      }

      entries.set(routeKey, {
        kind: functionKind,
        ref: functionRef,
      });
    }
  }

  return entries;
}

/**
 * Add generic plugin auth API routes to TanStack Start handler.
 *
 * Endpoint shape:
 * - POST `/api/auth/plugin/<plugin-name>/<function-name>`
 */
export function pluginApiPlugin(
  options: TanStackStartPluginApiPluginOptions
): TanStackStartAuthApiPluginFactory {
  const routePrefix = normalizePluginRoutePrefix(options.routePrefix ?? "plugin");

  return {
    id: PLUGIN_API_PLUGIN_ID,
    create: ({ fetchers, convexFunctions }) => {
      const routeEntries = resolvePluginRouteEntries(
        options.pluginMeta,
        convexFunctions
      );
      return {
        id: PLUGIN_API_PLUGIN_ID,
        handle: async (context) => {
          const actionPrefix = `${routePrefix}/`;
          if (!context.action.startsWith(actionPrefix)) {
            return null;
          }
          if (context.method !== "POST") {
            return context.json({ error: "Method not allowed" }, 405);
          }

          const pluginAction = context.action.slice(actionPrefix.length);
          const entry = routeEntries.get(pluginAction);
          if (!entry) {
            return null;
          }
          const payload = await context.readJson();
          const args = parsePluginArgs(payload);
          if (!args) {
            return context.json({ error: "Invalid request body" }, 400);
          }

          if (entry.kind === "query") {
            const result = await fetchers.fetchAuthQuery(
              entry.ref as FunctionReference<"query", "public">,
              args as FunctionArgs<FunctionReference<"query", "public">>
            );
            return context.json(result);
          }
          if (entry.kind === "mutation") {
            const result = await fetchers.fetchAuthMutation(
              entry.ref as FunctionReference<"mutation", "public">,
              args as FunctionArgs<FunctionReference<"mutation", "public">>
            );
            return context.json(result);
          }

          const result = await fetchers.fetchAuthAction(
            entry.ref as FunctionReference<"action", "public">,
            args as FunctionArgs<FunctionReference<"action", "public">>
          );
          return context.json(result);
        },
      };
    },
  };
}
