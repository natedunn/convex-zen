import type { TanStackStartAuthApiClientPlugin } from "./tanstack-start-client";

function normalizeRoutePrefix(prefix: string): string {
  const trimmed = prefix.trim().replace(/^\/+|\/+$/g, "");
  return trimmed.length > 0 ? trimmed : "admin";
}

export interface TanStackStartAdminListUsersInput {
  limit?: number;
  cursor?: string;
}

export interface TanStackStartAdminBanUserInput {
  userId: string;
  reason?: string;
  expiresAt?: number;
}

export interface TanStackStartAdminSetRoleInput {
  userId: string;
  role: string;
}

export interface TanStackStartAdminUserIdInput {
  userId: string;
}

export interface TanStackStartAdminClientPluginShape<
  TListUsersOutput = unknown,
  TBanUserOutput = unknown,
  TSetRoleOutput = unknown,
  TUnbanUserOutput = unknown,
  TDeleteUserOutput = unknown,
> {
  admin: {
    listUsers: (
      input?: TanStackStartAdminListUsersInput
    ) => Promise<TListUsersOutput>;
    banUser: (input: TanStackStartAdminBanUserInput) => Promise<TBanUserOutput>;
    setRole: (input: TanStackStartAdminSetRoleInput) => Promise<TSetRoleOutput>;
    unbanUser: (input: TanStackStartAdminUserIdInput) => Promise<TUnbanUserOutput>;
    deleteUser: (
      input: TanStackStartAdminUserIdInput
    ) => Promise<TDeleteUserOutput>;
  };
}

export interface TanStackStartAdminClientPluginOptions {
  routePrefix?: string;
}

/**
 * Adds `authClient.admin.*` methods to the TanStack auth API client.
 */
export function adminClient<
  TListUsersOutput = unknown,
  TBanUserOutput = unknown,
  TSetRoleOutput = unknown,
  TUnbanUserOutput = unknown,
  TDeleteUserOutput = unknown,
>(
  options: TanStackStartAdminClientPluginOptions = {}
): TanStackStartAuthApiClientPlugin<
  TanStackStartAdminClientPluginShape<
    TListUsersOutput,
    TBanUserOutput,
    TSetRoleOutput,
    TUnbanUserOutput,
    TDeleteUserOutput
  >
> {
  const routePrefix = normalizeRoutePrefix(options.routePrefix ?? "admin");

  return {
    id: "admin",
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
        admin: {
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
