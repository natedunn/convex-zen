import type { PluginGatewayRuntimeMap } from "convex-zen";
import { definePlugin } from "convex-zen";
import * as gatewayModule from "./gateway";

export interface ExamplePluginOptions {
  defaultScope?: string;
}

type ExampleGatewayRuntime = PluginGatewayRuntimeMap<typeof gatewayModule>;

type ExampleLogContext = {
  runMutation(fn: unknown, args: Record<string, unknown>): Promise<unknown>;
};

type ExampleQueryContext = {
  runQuery(fn: unknown, args: Record<string, unknown>): Promise<unknown>;
};

export class ExamplePlugin {
  constructor(
    private readonly gateway: ExampleGatewayRuntime,
    private readonly options: ExamplePluginOptions
  ) {}

  private resolveScope(scope: string | undefined): string | undefined {
    const normalized = scope?.trim();
    if (normalized && normalized.length > 0) {
      return normalized;
    }
    const fallback = this.options.defaultScope?.trim();
    return fallback && fallback.length > 0 ? fallback : undefined;
  }

  async logInfo(
    ctx: ExampleLogContext,
    args: {
      message: string;
      scope?: string;
      tag?: string;
    }
  ) {
    const scope = this.resolveScope(args.scope);
    return this.gateway.log(ctx, {
      message: args.message,
      level: "info",
      ...(scope !== undefined ? { scope } : {}),
      ...(args.tag !== undefined ? { tag: args.tag } : {}),
    });
  }

  async getDefaultScopeLogs(
    ctx: ExampleQueryContext,
    args?: {
      limit?: number;
    }
  ) {
    const scope = this.resolveScope(undefined);
    return this.gateway.listLogs(ctx, {
      ...(scope !== undefined ? { scope } : {}),
      ...(args?.limit !== undefined ? { limit: args.limit } : {}),
    });
  }
}

export const examplePlugin = definePlugin({
  id: "example",
  gateway: gatewayModule,
  normalizeOptions: (options?: ExamplePluginOptions): ExamplePluginOptions => ({
    ...(options?.defaultScope !== undefined
      ? { defaultScope: options.defaultScope }
      : {}),
  }),
  extendRuntime: ({ gateway, options }) =>
    new ExamplePlugin(gateway as ExampleGatewayRuntime, options),
});
