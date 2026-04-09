import type { TanStackStartAuthApiClientPlugin } from "./client.js";

function normalizeRoutePrefix(prefix: string): string {
  const trimmed = prefix.trim().replace(/^\/+|\/+$/g, "");
  return trimmed.length > 0 ? trimmed : "system-admin";
}

export const SYSTEM_ADMIN_CLIENT_PLUGIN_ID = "systemAdmin" as const;

export interface TanStackStartSystemAdminListUsersInput {
  limit?: number;
  cursor?: string;
}

export interface TanStackStartSystemAdminBanUserInput {
  userId: string;
  reason?: string;
  expiresAt?: number;
}

export interface TanStackStartSystemAdminSetRoleInput {
  userId: string;
  role: string;
}

export interface TanStackStartSystemAdminUserIdInput {
  userId: string;
}

export interface TanStackStartSystemAdminClientPluginShape<
  TListUsersOutput = unknown,
  TBanUserOutput = unknown,
  TSetRoleOutput = unknown,
  TUnbanUserOutput = unknown,
  TDeleteUserOutput = unknown,
> {
  systemAdmin: {
    listUsers: (
      input?: TanStackStartSystemAdminListUsersInput
    ) => Promise<TListUsersOutput>;
    banUser: (input: TanStackStartSystemAdminBanUserInput) => Promise<TBanUserOutput>;
    setRole: (input: TanStackStartSystemAdminSetRoleInput) => Promise<TSetRoleOutput>;
    unbanUser: (input: TanStackStartSystemAdminUserIdInput) => Promise<TUnbanUserOutput>;
    deleteUser: (
      input: TanStackStartSystemAdminUserIdInput
    ) => Promise<TDeleteUserOutput>;
  };
}

export interface TanStackStartSystemAdminClientPluginOptions {
  routePrefix?: string;
}

/**
 * Adds `authClient.systemAdmin.*` methods to the TanStack auth API client.
 */
export function systemAdminClient<
  TListUsersOutput = unknown,
  TBanUserOutput = unknown,
  TSetRoleOutput = unknown,
  TUnbanUserOutput = unknown,
  TDeleteUserOutput = unknown,
>(
  options: TanStackStartSystemAdminClientPluginOptions = {}
): TanStackStartAuthApiClientPlugin<
  TanStackStartSystemAdminClientPluginShape<
    TListUsersOutput,
    TBanUserOutput,
    TSetRoleOutput,
    TUnbanUserOutput,
    TDeleteUserOutput
  >
> {
  const routePrefix = normalizeRoutePrefix(options.routePrefix ?? "system-admin");

  return {
    id: SYSTEM_ADMIN_CLIENT_PLUGIN_ID,
    create: (context) => {
      const post = async <T>(path: string, input: unknown, fallback: string) => {
        return context.requestJson<T>(
          `${routePrefix}/${path}`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(input),
          },
          { fallback }
        );
      };

      return {
        systemAdmin: {
          listUsers: async (input) =>
            post<TListUsersOutput>(
              "list-users",
              input ?? {},
              "Could not list users"
            ),
          banUser: async (input) =>
            post<TBanUserOutput>("ban-user", input, "Could not ban user"),
          setRole: async (input) =>
            post<TSetRoleOutput>("set-role", input, "Could not set role"),
          unbanUser: async (input) =>
            post<TUnbanUserOutput>("unban-user", input, "Could not unban user"),
          deleteUser: async (input) =>
            post<TDeleteUserOutput>(
              "delete-user",
              input,
              "Could not delete user"
            ),
        },
      };
    },
  };
}
