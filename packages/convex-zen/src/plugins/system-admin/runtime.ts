import {
  definePlugin,
  type PluginGatewayRuntimeMap,
  type SystemAdminListUsersResult,
  type SystemAdminPluginOptions,
} from "../../client/index.js";
import * as gatewayModule from "./gateway.js";
import { schema } from "./schema.js";

type RunsQueries = {
  runQuery(fn: unknown, args: Record<string, unknown>): Promise<unknown>;
};

type RunsMutations = {
  runMutation(fn: unknown, args: Record<string, unknown>): Promise<unknown>;
};

type SystemAdminGatewayRuntime = PluginGatewayRuntimeMap<typeof gatewayModule>;

export class SystemAdminPlugin {
  constructor(
    private readonly gateway: SystemAdminGatewayRuntime,
    private readonly config: SystemAdminPluginOptions
  ) {}

  private resolveAdminRole(): string {
    const normalized = this.config.adminRole?.trim();
    return normalized && normalized.length > 0 ? normalized : "admin";
  }

  private withAdminRole<T extends Record<string, unknown>>(args: T): T & { adminRole?: string } {
    return {
      ...args,
      adminRole: this.resolveAdminRole(),
    };
  }

  async isAdmin(
    ctx: RunsQueries
  ): Promise<boolean> {
    return this.gateway.isAdmin(ctx, this.withAdminRole({})) as Promise<boolean>;
  }

  async canBootstrapAdmin(
    ctx: RunsQueries
  ): Promise<boolean> {
    return this.gateway.canBootstrapAdmin(
      ctx,
      this.withAdminRole({})
    ) as Promise<boolean>;
  }

  async bootstrapAdmin(
    ctx: RunsMutations
  ): Promise<boolean> {
    return this.gateway.bootstrapAdmin(
      ctx,
      this.withAdminRole({})
    ) as Promise<boolean>;
  }

  async listUsers(
    ctx: RunsQueries,
    args: {
      actorUserId?: string;
      limit?: number;
      cursor?: string;
    }
  ): Promise<SystemAdminListUsersResult> {
    const { actorUserId: _actorUserId, ...rest } = args;
    return this.gateway.listUsers(ctx, this.withAdminRole(rest)) as Promise<SystemAdminListUsersResult>;
  }

  async banUser(
    ctx: RunsMutations,
    args: {
      actorUserId?: string;
      userId: string;
      reason?: string;
      expiresAt?: number;
    }
  ): Promise<void> {
    const { actorUserId: _actorUserId, ...rest } = args;
    return this.gateway.banUser(ctx, this.withAdminRole(rest)) as Promise<void>;
  }

  async unbanUser(
    ctx: RunsMutations,
    args: {
      actorUserId?: string;
      userId: string;
    }
  ): Promise<void> {
    const { actorUserId: _actorUserId, ...rest } = args;
    return this.gateway.unbanUser(ctx, this.withAdminRole(rest)) as Promise<void>;
  }

  async setRole(
    ctx: RunsMutations,
    args: {
      actorUserId?: string;
      userId: string;
      role: string;
    }
  ): Promise<void> {
    const { actorUserId: _actorUserId, ...rest } = args;
    return this.gateway.setRole(ctx, this.withAdminRole(rest)) as Promise<void>;
  }

  async deleteUser(
    ctx: RunsMutations,
    args: {
      actorUserId?: string;
      userId: string;
    }
  ): Promise<void> {
    const { actorUserId: _actorUserId, ...rest } = args;
    return this.gateway.deleteUser(ctx, this.withAdminRole(rest)) as Promise<void>;
  }

  get defaultRole() {
    return this.config.defaultRole;
  }

  get adminRole() {
    return this.config.adminRole;
  }
}

export const systemAdminPlugin = definePlugin({
  id: "systemAdmin",
  schema,
  gateway: gatewayModule,
  normalizeOptions: (config?: SystemAdminPluginOptions): SystemAdminPluginOptions => ({
    ...(config?.defaultRole !== undefined
      ? { defaultRole: config.defaultRole }
      : {}),
    ...(config?.adminRole !== undefined ? { adminRole: config.adminRole } : {}),
  }),
  extendRuntime: ({ gateway, options }) =>
    new SystemAdminPlugin(gateway as SystemAdminGatewayRuntime, options),
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
  },
});
