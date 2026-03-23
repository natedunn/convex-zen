import type { FunctionArgs, FunctionReference } from "convex/server";
import type { TanStackStartAuthApiPluginFactory } from "./index";
import { readFunctionRef, isRecord, readMember } from "../helpers";

type MutationRef = FunctionReference<"mutation", "public">;
type QueryRef = FunctionReference<"query", "public">;

export interface TanStackStartSystemAdminApiPluginConvexFunctions {
  listUsers: QueryRef;
  banUser: MutationRef;
  setRole: MutationRef;
  unbanUser: MutationRef;
  deleteUser: MutationRef;
}

export interface TanStackStartSystemAdminApiPluginOptions {
  /**
   * Optional explicit Convex function refs.
   * If omitted, refs are auto-resolved from
   * `createTanStackAuthServer({ convexFunctions })`
   * using standard generated names.
   */
  convexFunctions?: Partial<TanStackStartSystemAdminApiPluginConvexFunctions>;
  routePrefix?: string;
}

export const SYSTEM_ADMIN_API_PLUGIN_ID = "systemAdmin" as const;

export const REQUIRED_SYSTEM_ADMIN_CONVEX_FUNCTIONS = [
  "listUsers",
  "banUser",
  "setRole",
  "unbanUser",
  "deleteUser",
] as const;

type RequiredAdminConvexFunctionName =
  (typeof REQUIRED_SYSTEM_ADMIN_CONVEX_FUNCTIONS)[number];

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
      `systemAdminApiPlugin could not resolve "${functionName}" convex function. ` +
        "Expose standard generated refs on createTanStackAuthServer({ convexFunctions }) or pass convexFunctions explicitly."
    );
  }
  return resolved;
}

function resolveSystemAdminConvexFunctions(
  options: TanStackStartSystemAdminApiPluginOptions | undefined,
  convexFunctionRefs: Record<string, unknown> | undefined
): TanStackStartSystemAdminApiPluginConvexFunctions {
  const refs = convexFunctionRefs ?? {};
  const systemAdminGroup = readMember(refs, "systemAdmin");
  const pluginSystemAdminGroup = readMember(readMember(refs, "plugin"), "systemAdmin");
  const fromAnySystemAdminGroup = (name: string): unknown =>
    readMember(refs, name) ??
    readMember(systemAdminGroup, name) ??
    readMember(pluginSystemAdminGroup, name);
  const explicitActions = options?.convexFunctions;
  const resolved: TanStackStartSystemAdminApiPluginConvexFunctions = {
    listUsers: resolveRequiredConvexFunction(
      explicitActions?.listUsers,
      fromAnySystemAdminGroup("listUsers"),
      "listUsers"
    ) as QueryRef,
    banUser: resolveRequiredConvexFunction(
      explicitActions?.banUser,
      fromAnySystemAdminGroup("banUser"),
      "banUser"
    ) as MutationRef,
    setRole: resolveRequiredConvexFunction(
      explicitActions?.setRole,
      fromAnySystemAdminGroup("setRole"),
      "setRole"
    ) as MutationRef,
    unbanUser: resolveRequiredConvexFunction(
      explicitActions?.unbanUser,
      fromAnySystemAdminGroup("unbanUser"),
      "unbanUser"
    ) as MutationRef,
    deleteUser: resolveRequiredConvexFunction(
      explicitActions?.deleteUser,
      fromAnySystemAdminGroup("deleteUser"),
      "deleteUser"
    ) as MutationRef,
  };
  return resolved;
}

function normalizeRoutePrefix(prefix: string): string {
  const trimmed = prefix.trim().replace(/^\/+|\/+$/g, "");
  return trimmed.length > 0 ? trimmed : "system-admin";
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

/**
 * Add System Admin auth API routes to TanStack Start handler.
 *
 * Endpoints:
 * - POST `/api/auth/system-admin/list-users`
 * - POST `/api/auth/system-admin/ban-user`
 * - POST `/api/auth/system-admin/set-role`
 * - POST `/api/auth/system-admin/unban-user`
 * - POST `/api/auth/system-admin/delete-user`
 */
export function systemAdminApiPlugin(
  options: TanStackStartSystemAdminApiPluginOptions = {}
): TanStackStartAuthApiPluginFactory {
  const routePrefix = normalizeRoutePrefix(options.routePrefix ?? "system-admin");

  return {
    id: SYSTEM_ADMIN_API_PLUGIN_ID,
    create: ({ fetchers, convexFunctions }) => {
      const resolvedFunctions = resolveSystemAdminConvexFunctions(
        options,
        convexFunctions
      );
      return {
        id: SYSTEM_ADMIN_API_PLUGIN_ID,
        handle: async (context) => {
          const actionPrefix = `${routePrefix}/`;
          if (!context.action.startsWith(actionPrefix)) {
            return null;
          }
          if (context.method !== "POST") {
            return context.json({ error: "Method not allowed" }, 405);
          }

          const systemAdminAction = context.action.slice(actionPrefix.length);
          const payload = await context.readJson();

          if (systemAdminAction === "list-users") {
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

          if (systemAdminAction === "ban-user") {
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

          if (systemAdminAction === "set-role") {
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

          if (systemAdminAction === "unban-user") {
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

          if (systemAdminAction === "delete-user") {
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
