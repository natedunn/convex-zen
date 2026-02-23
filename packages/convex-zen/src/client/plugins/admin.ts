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

  private getAdminToken(args: { adminToken?: string; token?: string }): string {
    const token = args.adminToken ?? args.token;
    if (!token) {
      throw new Error("adminToken is required");
    }
    return token;
  }

  private stringifyError(error: unknown): string {
    const errorObj = error as { message?: unknown; data?: unknown } | null;
    return [
      error instanceof Error ? error.message : "",
      typeof errorObj?.message === "string" ? errorObj.message : "",
      typeof errorObj?.data === "string"
        ? errorObj.data
        : errorObj?.data
          ? JSON.stringify(errorObj.data)
          : "",
      String(error),
    ]
      .filter(Boolean)
      .join(" | ");
  }

  private isRetryableGatewayShapeError(error: unknown): boolean {
    const details = this.stringifyError(error);
    return (
      details.includes("Object contains extra field") ||
      details.includes("ArgumentValidationError") ||
      details.includes("Server Error")
    );
  }

  private async runAdminGatewayAction(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ctx: { runAction: (fn: any, args: any) => Promise<any> },
    path: string,
    args: Record<string, unknown> & { adminToken?: string; token?: string }
  ) {
    const adminToken = this.getAdminToken(args);
    const payload = { ...args };
    delete payload.adminToken;
    delete payload.token;

    const attempts = [
      { ...payload, adminToken },
      payload,
      { ...payload, token: adminToken },
    ];

    let lastError: unknown = null;
    for (let i = 0; i < attempts.length; i += 1) {
      const attempt = attempts[i];
      try {
        return await ctx.runAction(this.fn(path), attempt);
      } catch (error) {
        const isLastAttempt = i === attempts.length - 1;
        if (isLastAttempt || !this.isRetryableGatewayShapeError(error)) {
          throw error;
        }
        lastError = error;
      }
    }

    throw lastError ?? new Error(`Failed to call admin action: ${path}`);
  }

  /**
   * List users with pagination.
   */
  async listUsers(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ctx: { runAction: (fn: any, args: any) => Promise<any> },
    args: { adminToken?: string; token?: string; limit?: number; cursor?: string }
  ) {
    return this.runAdminGatewayAction(ctx, "gateway:adminListUsers", args);
  }

  /**
   * Ban a user, invalidating all their sessions.
   */
  async banUser(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ctx: { runAction: (fn: any, args: any) => Promise<any> },
    args: {
      adminToken?: string;
      token?: string;
      userId: string;
      reason?: string;
      expiresAt?: number;
    }
  ) {
    return this.runAdminGatewayAction(ctx, "gateway:adminBanUser", args);
  }

  /**
   * Unban a user.
   */
  async unbanUser(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ctx: { runAction: (fn: any, args: any) => Promise<any> },
    args: { adminToken?: string; token?: string; userId: string }
  ) {
    return this.runAdminGatewayAction(ctx, "gateway:adminUnbanUser", args);
  }

  /**
   * Set a user's role.
   */
  async setRole(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ctx: { runAction: (fn: any, args: any) => Promise<any> },
    args: { adminToken?: string; token?: string; userId: string; role: string }
  ) {
    return this.runAdminGatewayAction(ctx, "gateway:adminSetRole", args);
  }

  /**
   * Permanently delete a user and all associated data.
   */
  async deleteUser(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ctx: { runAction: (fn: any, args: any) => Promise<any> },
    args: { adminToken?: string; token?: string; userId: string }
  ) {
    return this.runAdminGatewayAction(ctx, "gateway:adminDeleteUser", args);
  }

  get defaultRole() {
    return this.config.defaultRole;
  }

  get adminRole() {
    return this.config.adminRole;
  }
}
