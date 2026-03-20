import {
  defineAuthPlugin,
  type AdminListUsersResult,
  type AdminPluginOptions,
} from "../../types";
import { resolveComponentFn } from "../helpers";

/**
 * Admin plugin client module.
 *
 * This file is intentionally small: it owns the admin plugin config factory and
 * the raw `auth.plugins.admin` wrapper. Higher-level app-facing composition
 * still happens in the main client entrypoint.
 */

type RunsQueries = {
  runQuery(fn: unknown, args: Record<string, unknown>): Promise<unknown>;
};

type RunsMutations = {
  runMutation(fn: unknown, args: Record<string, unknown>): Promise<unknown>;
};

/**
 * Raw admin plugin API exposed at `auth.plugins.admin`.
 */
export class AdminPlugin {
  constructor(
    private readonly componentApi: Record<string, unknown>,
    private readonly config: AdminPluginOptions,
    private readonly childName: string = "admin",
    private readonly runtimeKind: "app" | "component" = "app"
  ) {}

  private resolveAdminRole(): string {
    const normalized = this.config.adminRole?.trim();
    return normalized && normalized.length > 0 ? normalized : "admin";
  }

  private withAdminRole<T extends Record<string, unknown>>(args: T): T & { adminRole: string } {
    return {
      ...args,
      adminRole: this.resolveAdminRole(),
    };
  }

  /**
   * Resolve a nested component function reference from a path string.
   * e.g. "plugins/admin:listUsers" → component.plugins.admin.listUsers
   */
  private fn(path: string): unknown {
    return resolveComponentFn(this.componentApi, path);
  }

  private gatewayPath(functionName: string): string {
    if (this.runtimeKind === "app") {
      return `admin/gateway:${functionName}`;
    }
    return `${this.childName}/gateway:${functionName}`;
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
      this.gatewayPath("isAdmin"),
      this.withAdminRole(args)
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
      this.gatewayPath("listUsers"),
      this.withAdminRole(args)
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
      this.gatewayPath("banUser"),
      this.withAdminRole(args)
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
      this.gatewayPath("unbanUser"),
      this.withAdminRole(args)
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
      this.gatewayPath("setRole"),
      this.withAdminRole(args)
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
      this.gatewayPath("deleteUser"),
      this.withAdminRole(args)
    ) as Promise<void>;
  }

  get defaultRole() {
    return this.config.defaultRole;
  }

  get adminRole() {
    return this.config.adminRole;
  }
}

export const adminPlugin = defineAuthPlugin({
  id: "admin",
  component: {
    importPath: "convex-zen/plugins/admin/convex.config",
    childName: "adminComponent",
  },
  normalizeOptions: (config?: AdminPluginOptions): AdminPluginOptions => ({
    ...(config?.defaultRole !== undefined
      ? { defaultRole: config.defaultRole }
      : {}),
    ...(config?.adminRole !== undefined ? { adminRole: config.adminRole } : {}),
  }),
  createClientRuntime: ({ component, childName, options, runtimeKind }) =>
    new AdminPlugin(component, options, childName, runtimeKind),
  publicFunctions: {
    functions: {
      isAdmin: {
        kind: "query",
        auth: "optionalActor",
        runtimeMethod: "isAdmin",
        componentPath: "admin/gateway:isAdmin",
        argsSource: "{}",
      },
      listUsers: {
        kind: "query",
        auth: "actor",
        runtimeMethod: "listUsers",
        componentPath: "admin/gateway:listUsers",
        argsSource: "{\n    limit: v.optional(v.number()),\n    cursor: v.optional(v.string()),\n  }",
      },
      banUser: {
        kind: "mutation",
        auth: "actor",
        runtimeMethod: "banUser",
        componentPath: "admin/gateway:banUser",
        argsSource:
          "{\n    userId: v.string(),\n    reason: v.optional(v.string()),\n    expiresAt: v.optional(v.number()),\n  }",
      },
      unbanUser: {
        kind: "mutation",
        auth: "actor",
        runtimeMethod: "unbanUser",
        componentPath: "admin/gateway:unbanUser",
        argsSource: "{\n    userId: v.string(),\n  }",
      },
      setRole: {
        kind: "mutation",
        auth: "actor",
        runtimeMethod: "setRole",
        componentPath: "admin/gateway:setRole",
        argsSource: "{\n    userId: v.string(),\n    role: v.string(),\n  }",
      },
      deleteUser: {
        kind: "mutation",
        auth: "actor",
        runtimeMethod: "deleteUser",
        componentPath: "admin/gateway:deleteUser",
        argsSource: "{\n    userId: v.string(),\n  }",
      },
    },
  },
  hooks: {
    onUserCreated: {
      defaultRole: (options) => {
        const role = options.defaultRole?.trim();
        return role && role.length > 0 ? role : "user";
      },
    },
    assertCanCreateSession: true,
    assertCanResolveSession: true,
    assertCanReadAuthUser: true,
    onUserDeleted: true,
  },
});
