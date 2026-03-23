import {
  definePlugin,
  type AdminListUsersResult,
  type AdminPluginOptions,
  type PluginGatewayRuntimeMap,
} from "convex-zen";
import * as gatewayModule from "./gateway";

type RunsQueries = {
  runQuery(fn: unknown, args: Record<string, unknown>): Promise<unknown>;
};

type RunsMutations = {
  runMutation(fn: unknown, args: Record<string, unknown>): Promise<unknown>;
};

type AdminRuntimeHelpers = {
  callInternalMutation?: (
    ctx: RunsMutations,
    functionName: string,
    args: Record<string, unknown>
  ) => Promise<unknown>;
  deleteAuthUser?: (ctx: RunsMutations, userId: string) => Promise<void>;
};

function resolveComponentFn(
  api: Record<string, unknown>,
  path: string
): unknown {
  const [modulePath, funcName] = path.split(":");
  if (!modulePath || !funcName) {
    throw new Error(`Invalid function path: ${path}`);
  }
  const parts = modulePath.split("/");
  let ref: Record<string, unknown> = api;
  for (const part of parts) {
    const next = ref[part];
    if (!next || typeof next !== "object" || Array.isArray(next)) {
      throw new Error(`Invalid function path segment: ${part}`);
    }
    ref = next as Record<string, unknown>;
  }
  const resolved = ref[funcName];
  if (!resolved) {
    throw new Error(`Function not found: ${path}`);
  }
  return resolved;
}

type AdminGatewayRuntime = PluginGatewayRuntimeMap<typeof gatewayModule>;

export class AdminPlugin {
  private readonly usesGatewayRuntime: boolean;

  constructor(
    gatewayOrComponentApi: AdminGatewayRuntime | Record<string, unknown>,
    private readonly config: AdminPluginOptions,
    childName: string = "adminComponent",
    private readonly runtimeKind: "app" | "component" = "app",
    private readonly helpers: AdminRuntimeHelpers = {}
  ) {
    this.usesGatewayRuntime = this.isGatewayRuntime(gatewayOrComponentApi);
    this.gateway = this.usesGatewayRuntime
      ? (gatewayOrComponentApi as AdminGatewayRuntime)
      : this.createLegacyGatewayRuntime(gatewayOrComponentApi, childName);
  }

  private readonly gateway: AdminGatewayRuntime;

  private isGatewayRuntime(
    value: AdminGatewayRuntime | Record<string, unknown>
  ): value is AdminGatewayRuntime {
    return typeof (value as AdminGatewayRuntime).isAdmin === "function";
  }

  private createLegacyGatewayRuntime(
    componentApi: Record<string, unknown>,
    childName: string
  ): AdminGatewayRuntime {
    const gatewayPath = (functionName: string) =>
      this.runtimeKind === "component"
        ? `${childName}/gateway:${functionName}`
        : `admin/gateway:${functionName}`;
    return {
      isAdmin: async (ctx, args) =>
        await (ctx as RunsQueries).runQuery(
          resolveComponentFn(componentApi, gatewayPath("isAdmin")),
          args
        ),
      listUsers: async (ctx, args) =>
        await (ctx as RunsQueries).runQuery(
          resolveComponentFn(componentApi, gatewayPath("listUsers")),
          args
        ),
      banUser: async (ctx, args) =>
        await (ctx as RunsMutations).runMutation(
          resolveComponentFn(componentApi, gatewayPath("banUser")),
          args
        ),
      unbanUser: async (ctx, args) =>
        await (ctx as RunsMutations).runMutation(
          resolveComponentFn(componentApi, gatewayPath("unbanUser")),
          args
        ),
      setRole: async (ctx, args) =>
        await (ctx as RunsMutations).runMutation(
          resolveComponentFn(componentApi, gatewayPath("setRole")),
          args
        ),
      deleteUser: async (ctx, args) =>
        await (ctx as RunsMutations).runMutation(
          resolveComponentFn(componentApi, gatewayPath("deleteUser")),
          args
        ),
    } as AdminGatewayRuntime;
  }

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
    ctx: RunsQueries,
    args?: {
      actorUserId?: string;
    }
  ): Promise<boolean> {
    const inputArgs = this.usesGatewayRuntime
      ? {}
      : { actorUserId: args?.actorUserId };
    return this.gateway.isAdmin(ctx, this.withAdminRole(inputArgs)) as Promise<boolean>;
  }

  async listUsers(
    ctx: RunsQueries,
    args: {
      actorUserId?: string;
      limit?: number;
      cursor?: string;
    }
  ): Promise<AdminListUsersResult> {
    const { actorUserId, ...rest } = args;
    const inputArgs = this.usesGatewayRuntime ? rest : { actorUserId, ...rest };
    return this.gateway.listUsers(ctx, this.withAdminRole(inputArgs)) as Promise<AdminListUsersResult>;
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
    const { actorUserId, ...rest } = args;
    const inputArgs = this.usesGatewayRuntime ? rest : { actorUserId, ...rest };
    return this.gateway.banUser(ctx, this.withAdminRole(inputArgs)) as Promise<void>;
  }

  async unbanUser(
    ctx: RunsMutations,
    args: {
      actorUserId?: string;
      userId: string;
    }
  ): Promise<void> {
    const { actorUserId, ...rest } = args;
    const inputArgs = this.usesGatewayRuntime ? rest : { actorUserId, ...rest };
    return this.gateway.unbanUser(ctx, this.withAdminRole(inputArgs)) as Promise<void>;
  }

  async setRole(
    ctx: RunsMutations,
    args: {
      actorUserId?: string;
      userId: string;
      role: string;
    }
  ): Promise<void> {
    const { actorUserId, ...rest } = args;
    const inputArgs = this.usesGatewayRuntime ? rest : { actorUserId, ...rest };
    return this.gateway.setRole(ctx, this.withAdminRole(inputArgs)) as Promise<void>;
  }

  async deleteUser(
    ctx: RunsMutations,
    args: {
      actorUserId?: string;
      userId: string;
    }
  ): Promise<void> {
    if (!this.helpers.callInternalMutation || !this.helpers.deleteAuthUser) {
      const { actorUserId, ...rest } = args;
      const inputArgs = this.usesGatewayRuntime ? rest : { actorUserId, ...rest };
      return this.gateway.deleteUser(ctx, this.withAdminRole(inputArgs)) as Promise<void>;
    }

    const inputArgs = this.withAdminRole(
      this.usesGatewayRuntime
        ? { userId: args.userId }
        : {
            actorUserId: args.actorUserId,
            userId: args.userId,
          }
    );

    await this.helpers.callInternalMutation(
      ctx,
      "deleteUserAdminState",
      inputArgs
    );
    await this.helpers.deleteAuthUser(ctx, args.userId);
  }

  get defaultRole() {
    return this.config.defaultRole;
  }

  get adminRole() {
    return this.config.adminRole;
  }
}

export const adminPlugin = definePlugin({
  id: "admin",
  gateway: gatewayModule,
  normalizeOptions: (config?: AdminPluginOptions): AdminPluginOptions => ({
    ...(config?.defaultRole !== undefined
      ? { defaultRole: config.defaultRole }
      : {}),
    ...(config?.adminRole !== undefined ? { adminRole: config.adminRole } : {}),
  }),
  extendRuntime: ({
    gateway,
    options,
    runtimeKind,
    callInternalMutation,
    deleteAuthUser,
  }) =>
    new AdminPlugin(
      gateway as AdminGatewayRuntime,
      options,
      "adminComponent",
      runtimeKind,
      { callInternalMutation, deleteAuthUser }
    ),
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
