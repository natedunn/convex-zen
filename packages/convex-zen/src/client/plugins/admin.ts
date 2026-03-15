import type { AdminListUsersResult, AdminPluginConfig } from "../../types";
import { resolveComponentFn } from "../helpers";

type RunsQueries = {
  runQuery: (fn: unknown, args: Record<string, unknown>) => Promise<unknown>;
};

type RunsMutations = {
  runMutation: (fn: unknown, args: Record<string, unknown>) => Promise<unknown>;
};

/**
 * Create an admin plugin configuration.
 *
 * @example
 * ```ts
 * import { adminPlugin } from "convex-zen/plugins/admin";
 *
 * export const auth = new ConvexZen(components.convexAuth, {
 *   plugins: [adminPlugin({ defaultRole: "user", adminRole: "admin" })],
 * });
 * ```
 */
export function adminPlugin(config?: {
  defaultRole?: string;
  adminRole?: string;
}): AdminPluginConfig {
  const plugin: AdminPluginConfig = {
    id: "admin",
    defaultRole: "user",
    adminRole: "admin",
  };
  if (config?.defaultRole !== undefined) {
    plugin.defaultRole = config.defaultRole;
  }
  if (config?.adminRole !== undefined) {
    plugin.adminRole = config.adminRole;
  }
  return plugin;
}

/**
 * AdminPlugin client class — exposes admin operations as typed methods.
 * Obtained via `auth.plugins.admin` after ConvexZen is initialized with adminPlugin.
 */
export class AdminPlugin {
  constructor(
    private readonly componentApi: Record<string, unknown>,
    private readonly config: AdminPluginConfig
  ) {}

  private resolveAdminRole(): string {
    const normalized = this.config.adminRole?.trim();
    return normalized && normalized.length > 0 ? normalized : "admin";
  }

  /**
   * Resolve a nested component function reference from a path string.
   * e.g. "plugins/admin:listUsers" → component.plugins.admin.listUsers
   */
  private fn(path: string): unknown {
    return resolveComponentFn(this.componentApi, path);
  }

  private async runAdminGatewayMutation(
    ctx: RunsMutations,
    path: string,
    args: Record<string, unknown>
  ): Promise<unknown> {
    return ctx.runMutation(this.fn(path), args);
  }

  private async runAdminGatewayQuery(
    ctx: RunsQueries,
    path: string,
    args: Record<string, unknown>
  ): Promise<unknown> {
    return ctx.runQuery(this.fn(path), args);
  }

  /**
   * Returns true when the actor has an active admin role.
   */
  async isAdmin(
    ctx: RunsQueries,
    args: {
      actorUserId: string;
    }
  ): Promise<boolean> {
    return this.runAdminGatewayQuery(
      ctx,
      "gateway:adminIsAdmin",
      {
        ...args,
        adminRole: this.resolveAdminRole(),
      }
    ) as Promise<boolean>;
  }

  /**
   * List users with pagination.
   */
  async listUsers(
    ctx: RunsQueries,
    args: {
      actorUserId: string;
      limit?: number;
      cursor?: string;
    }
  ): Promise<AdminListUsersResult> {
    return this.runAdminGatewayQuery(
      ctx,
      "gateway:adminListUsers",
      {
        ...args,
        adminRole: this.resolveAdminRole(),
      }
    ) as Promise<AdminListUsersResult>;
  }

  /**
   * Ban a user, invalidating all their sessions.
   */
  async banUser(
    ctx: RunsMutations,
    args: {
      actorUserId: string;
      userId: string;
      reason?: string;
      expiresAt?: number;
    }
  ): Promise<void> {
    return this.runAdminGatewayMutation(
      ctx,
      "gateway:adminBanUser",
      {
        ...args,
        adminRole: this.resolveAdminRole(),
      }
    ) as Promise<void>;
  }

  /**
   * Unban a user.
   */
  async unbanUser(
    ctx: RunsMutations,
    args: {
      actorUserId: string;
      userId: string;
    }
  ): Promise<void> {
    return this.runAdminGatewayMutation(
      ctx,
      "gateway:adminUnbanUser",
      {
        ...args,
        adminRole: this.resolveAdminRole(),
      }
    ) as Promise<void>;
  }

  /**
   * Set a user's role.
   */
  async setRole(
    ctx: RunsMutations,
    args: {
      actorUserId: string;
      userId: string;
      role: string;
    }
  ): Promise<void> {
    return this.runAdminGatewayMutation(
      ctx,
      "gateway:adminSetRole",
      {
        ...args,
        adminRole: this.resolveAdminRole(),
      }
    ) as Promise<void>;
  }

  /**
   * Permanently delete a user and all associated data.
   */
  async deleteUser(
    ctx: RunsMutations,
    args: {
      actorUserId: string;
      userId: string;
    }
  ): Promise<void> {
    return this.runAdminGatewayMutation(
      ctx,
      "gateway:adminDeleteUser",
      {
        ...args,
        adminRole: this.resolveAdminRole(),
      }
    ) as Promise<void>;
  }

  get defaultRole() {
    return this.config.defaultRole;
  }

  get adminRole() {
    return this.config.adminRole;
  }
}
