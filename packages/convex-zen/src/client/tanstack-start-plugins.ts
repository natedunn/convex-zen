import type { FunctionArgs, FunctionReference } from "convex/server";
import type { TanStackStartAuthApiPluginFactory } from "./tanstack-start";

type ActionRef = FunctionReference<"action", "public">;
type UnknownRecord = Record<string, unknown>;

export interface TanStackStartAdminApiPluginActions {
  listUsers: ActionRef;
  banUser: ActionRef;
  setRole: ActionRef;
  unbanUser?: ActionRef;
  deleteUser?: ActionRef;
}

export interface TanStackStartAdminApiPluginOptions {
  actions: TanStackStartAdminApiPluginActions;
  routePrefix?: string;
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

/**
 * Add admin auth API routes to TanStack Start handler.
 *
 * Endpoints:
 * - POST `/api/auth/admin/list-users`
 * - POST `/api/auth/admin/ban-user`
 * - POST `/api/auth/admin/set-role`
 * - POST `/api/auth/admin/unban-user` (optional)
 * - POST `/api/auth/admin/delete-user` (optional)
 */
export function adminApiPlugin(
  options: TanStackStartAdminApiPluginOptions
): TanStackStartAuthApiPluginFactory {
  const routePrefix = normalizeRoutePrefix(options.routePrefix ?? "admin");

  return {
    id: "admin",
    create: ({ fetchers }) => ({
      id: "admin",
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
          const result = await fetchers.fetchAuthAction(
            options.actions.listUsers,
            args as FunctionArgs<typeof options.actions.listUsers>
          );
          return context.json(result);
        }

        if (adminAction === "ban-user") {
          const args = parseBanUserArgs(payload);
          if (!args) {
            return context.json({ error: "Invalid request body" }, 400);
          }
          const result = await fetchers.fetchAuthAction(
            options.actions.banUser,
            args as FunctionArgs<typeof options.actions.banUser>
          );
          return context.json(result);
        }

        if (adminAction === "set-role") {
          const args = parseSetRoleArgs(payload);
          if (!args) {
            return context.json({ error: "Invalid request body" }, 400);
          }
          const result = await fetchers.fetchAuthAction(
            options.actions.setRole,
            args as FunctionArgs<typeof options.actions.setRole>
          );
          return context.json(result);
        }

        if (adminAction === "unban-user") {
          if (!options.actions.unbanUser) {
            return context.json({ error: "Not found" }, 404);
          }
          const args = parseSingleUserIdArgs(payload);
          if (!args) {
            return context.json({ error: "Invalid request body" }, 400);
          }
          const result = await fetchers.fetchAuthAction(
            options.actions.unbanUser,
            args as FunctionArgs<typeof options.actions.unbanUser>
          );
          return context.json(result);
        }

        if (adminAction === "delete-user") {
          if (!options.actions.deleteUser) {
            return context.json({ error: "Not found" }, 404);
          }
          const args = parseSingleUserIdArgs(payload);
          if (!args) {
            return context.json({ error: "Invalid request body" }, 400);
          }
          const result = await fetchers.fetchAuthAction(
            options.actions.deleteUser,
            args as FunctionArgs<typeof options.actions.deleteUser>
          );
          return context.json(result);
        }

        return null;
      },
    }),
  };
}
