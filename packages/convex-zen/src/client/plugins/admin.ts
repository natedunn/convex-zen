import type { AdminPluginConfig } from "../../types";

/**
 * Create an admin plugin configuration.
 *
 * @example
 * ```ts
 * import { adminPlugin } from "convex-zen/plugins/admin";
 *
 * export const auth = new ConvexAuth(components.convexAuth, {
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
 * Obtained via `auth.plugins.admin` after ConvexAuth is initialized with adminPlugin.
 */
export class AdminPlugin {
  constructor(
    private readonly componentApi: Record<string, unknown>,
    private readonly config: AdminPluginConfig
  ) {}

  /**
   * Resolve a nested component function reference from a path string.
   * e.g. "plugins/admin:listUsers" → component.plugins.admin.listUsers
   */
  private fn(path: string): unknown {
    const [modulePath, funcName] = path.split(":");
    if (!modulePath || !funcName) {
      throw new Error(`Invalid function path: ${path}`);
    }
    const parts = modulePath.split("/");
    let ref: Record<string, unknown> = this.componentApi;
    for (const part of parts) {
      const next = ref[part];
      if (
        !next ||
        typeof next !== "object" ||
        Array.isArray(next)
      ) {
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

  /**
   * List users with pagination.
   */
  async listUsers(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ctx: { runAction: (fn: any, args: any) => Promise<any> },
    args: { adminToken: string; limit?: number; cursor?: string }
  ) {
    return ctx.runAction(this.fn("gateway:adminListUsers"), args);
  }

  /**
   * Ban a user, invalidating all their sessions.
   */
  async banUser(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ctx: { runAction: (fn: any, args: any) => Promise<any> },
    args: {
      adminToken: string;
      userId: string;
      reason?: string;
      expiresAt?: number;
    }
  ) {
    return ctx.runAction(this.fn("gateway:adminBanUser"), args);
  }

  /**
   * Unban a user.
   */
  async unbanUser(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ctx: { runAction: (fn: any, args: any) => Promise<any> },
    args: { adminToken: string; userId: string }
  ) {
    return ctx.runAction(this.fn("gateway:adminUnbanUser"), args);
  }

  /**
   * Set a user's role.
   */
  async setRole(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ctx: { runAction: (fn: any, args: any) => Promise<any> },
    args: { adminToken: string; userId: string; role: string }
  ) {
    return ctx.runAction(this.fn("gateway:adminSetRole"), args);
  }

  /**
   * Permanently delete a user and all associated data.
   */
  async deleteUser(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ctx: { runAction: (fn: any, args: any) => Promise<any> },
    args: { adminToken: string; userId: string }
  ) {
    return ctx.runAction(this.fn("gateway:adminDeleteUser"), args);
  }

  get defaultRole() {
    return this.config.defaultRole;
  }

  get adminRole() {
    return this.config.adminRole;
  }
}
