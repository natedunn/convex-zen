import type { FunctionArgs, FunctionReference } from "convex/server";
import type { TanStackStartAuthApiPluginFactory } from "./index";
import type {
  AuthCoreMeta,
  AuthPluginFunctionKind,
  AuthPluginMeta,
} from "../plugin-meta";
import { toKebabCase } from "../plugin-meta";
import { readFunctionRef, isRecord, readMember } from "../helpers";

export { systemAdminApiPlugin } from "./system-admin-plugin";
export type {
  TanStackStartSystemAdminApiPluginConvexFunctions,
  TanStackStartSystemAdminApiPluginOptions,
} from "./system-admin-plugin";
export {
  SYSTEM_ADMIN_API_PLUGIN_ID,
  REQUIRED_SYSTEM_ADMIN_CONVEX_FUNCTIONS,
} from "./system-admin-plugin";

export const CORE_API_PLUGIN_ID = "core" as const;

function parsePluginArgs(value: unknown): Record<string, unknown> | null {
  if (value === null || value === undefined) {
    return {};
  }
  if (!isRecord(value)) {
    return null;
  }
  return value;
}

function isUnauthorizedCoreRouteError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const message = error.message.toLowerCase();
  return message.includes("unauthorized") || message.includes("forbidden");
}

function isProductionRuntime(): boolean {
  return (
    typeof process !== "undefined" &&
    typeof process.env === "object" &&
    process.env?.NODE_ENV === "production"
  );
}

function logCurrentUserAuthBridgeFailure(error: unknown): void {
  if (isProductionRuntime()) {
    return;
  }
  const details =
    error instanceof Error
      ? { message: error.message, stack: error.stack }
      : { error };
  console.warn(
    "[convex-zen] core/current-user auth bridge failed (unauthorized). Returning null.",
    details
  );
}

type CoreRouteEntry = {
  ref: FunctionReference<"query" | "mutation" | "action", "public">;
};

export interface TanStackStartCoreApiPluginOptions {
  routePrefix?: string;
  coreMeta?: AuthCoreMeta;
}

function normalizeCoreRoutePrefix(prefix: string): string {
  const trimmed = prefix.trim().replace(/^\/+|\/+$/g, "");
  return trimmed.length > 0 ? trimmed : "core";
}

function resolveCoreRouteEntries(
  coreMeta: AuthCoreMeta | undefined,
  convexFunctions: Record<string, unknown> | undefined
): Map<string, CoreRouteEntry> {
  const entries = new Map<string, CoreRouteEntry>();
  const coreRoot = readMember(convexFunctions, "core");
  if (!coreRoot || (typeof coreRoot !== "object" && typeof coreRoot !== "function")) {
    return entries;
  }

  const coreFunctionNames = coreMeta
    ? Object.keys(coreMeta)
    : Object.keys(coreRoot as Record<string, unknown>);

  for (const functionName of coreFunctionNames) {
    const routeKey = toKebabCase(functionName);
    if (entries.has(routeKey)) {
      throw new Error(
        `coreApiPlugin found duplicate route mapping for "${routeKey}".`
      );
    }
    const functionRefCandidate = readMember(coreRoot, functionName);
    const functionRef = readFunctionRef<
      FunctionReference<"query" | "mutation" | "action", "public">
    >(functionRefCandidate);
    if (!functionRef) {
      if (coreMeta) {
        throw new Error(
          `coreApiPlugin could not resolve "convexFunctions.core.${functionName}".`
        );
      }
      continue;
    }
    entries.set(routeKey, { ref: functionRef });
  }
  return entries;
}

function shouldTryNextCoreKind(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const message = error.message.toLowerCase();
  return (
    message.includes("no query exists") ||
    message.includes("no mutation exists") ||
    message.includes("no action exists") ||
    message.includes("could not find public function") ||
    message.includes("is not a query") ||
    message.includes("is not a mutation") ||
    message.includes("is not an action")
  );
}

/**
 * Add generic core auth API routes to TanStack Start handler.
 *
 * Endpoint shape:
 * - POST `/api/auth/core/<function-name>`
 */
export function coreApiPlugin(
  options: TanStackStartCoreApiPluginOptions = {}
): TanStackStartAuthApiPluginFactory {
  const routePrefix = normalizeCoreRoutePrefix(options.routePrefix ?? "core");

  return {
    id: CORE_API_PLUGIN_ID,
    create: ({ fetchers, convexFunctions }) => {
      const routeEntries = resolveCoreRouteEntries(options.coreMeta, convexFunctions);
      return {
        id: CORE_API_PLUGIN_ID,
        handle: async (context) => {
          const actionPrefix = `${routePrefix}/`;
          if (!context.action.startsWith(actionPrefix)) {
            return null;
          }
          if (context.method !== "POST") {
            return context.json({ error: "Method not allowed" }, 405);
          }

          const coreAction = context.action.slice(actionPrefix.length);
          const entry = routeEntries.get(coreAction);
          if (!entry) {
            return null;
          }
          const payload = await context.readJson();
          const args = parsePluginArgs(payload);
          if (!args) {
            return context.json({ error: "Invalid request body" }, 400);
          }

          if (coreAction === "current-user") {
            try {
              const result = await fetchers.fetchAuthQuery(
                entry.ref as FunctionReference<"query", "public">,
                args as FunctionArgs<FunctionReference<"query", "public">>
              );
              return context.json(result);
            } catch (authQueryError) {
              if (isUnauthorizedCoreRouteError(authQueryError)) {
                logCurrentUserAuthBridgeFailure(authQueryError);
                return context.json(null);
              }
              throw authQueryError;
            }
          }

          try {
            const result = await fetchers.fetchMutation(
              entry.ref as FunctionReference<"mutation", "public">,
              args as FunctionArgs<FunctionReference<"mutation", "public">>
            );
            return context.json(result);
          } catch (mutationError) {
            if (!shouldTryNextCoreKind(mutationError)) {
              throw mutationError;
            }
          }

          try {
            const result = await fetchers.fetchQuery(
              entry.ref as FunctionReference<"query", "public">,
              args as FunctionArgs<FunctionReference<"query", "public">>
            );
            return context.json(result);
          } catch (queryError) {
            if (!shouldTryNextCoreKind(queryError)) {
              throw queryError;
            }
          }

          const result = await fetchers.fetchAction(
            entry.ref as FunctionReference<"action", "public">,
            args as FunctionArgs<FunctionReference<"action", "public">>
          );
          return context.json(result);
        },
      };
    },
  };
}

export const PLUGIN_API_PLUGIN_ID = "plugin" as const;

export interface TanStackStartPluginApiPluginOptions {
  pluginMeta: AuthPluginMeta;
  routePrefix?: string;
}

type PluginRouteEntry = {
  kind: AuthPluginFunctionKind;
  ref: FunctionReference<"query" | "mutation" | "action", "public">;
};

function normalizePluginRoutePrefix(prefix: string): string {
  const trimmed = prefix.trim().replace(/^\/+|\/+$/g, "");
  return trimmed.length > 0 ? trimmed : "plugin";
}

function resolvePluginRouteEntries(
  pluginMeta: AuthPluginMeta,
  convexFunctions: Record<string, unknown> | undefined
): Map<string, PluginRouteEntry> {
  const entries = new Map<string, PluginRouteEntry>();
  const pluginRoot = readMember(convexFunctions, "plugin");

  for (const [pluginName, pluginFunctions] of Object.entries(pluginMeta)) {
    for (const [functionName, functionKind] of Object.entries(pluginFunctions)) {
      const routeKey = `${toKebabCase(pluginName)}/${toKebabCase(functionName)}`;
      if (entries.has(routeKey)) {
        throw new Error(
          `pluginApiPlugin found duplicate route mapping for "${routeKey}".`
        );
      }

      const functionRefCandidate = readMember(
        readMember(pluginRoot, pluginName),
        functionName
      );
      const functionRef = readFunctionRef<
        FunctionReference<"query" | "mutation" | "action", "public">
      >(functionRefCandidate);
      if (!functionRef) {
        throw new Error(
          `pluginApiPlugin could not resolve "convexFunctions.plugin.${pluginName}.${functionName}".`
        );
      }

      entries.set(routeKey, {
        kind: functionKind,
        ref: functionRef,
      });
    }
  }

  return entries;
}

/**
 * Add generic plugin auth API routes to TanStack Start handler.
 *
 * Endpoint shape:
 * - POST `/api/auth/plugin/<plugin-name>/<function-name>`
 */
export function pluginApiPlugin(
  options: TanStackStartPluginApiPluginOptions
): TanStackStartAuthApiPluginFactory {
  const routePrefix = normalizePluginRoutePrefix(options.routePrefix ?? "plugin");

  return {
    id: PLUGIN_API_PLUGIN_ID,
    create: ({ fetchers, convexFunctions }) => {
      const routeEntries = resolvePluginRouteEntries(
        options.pluginMeta,
        convexFunctions
      );
      return {
        id: PLUGIN_API_PLUGIN_ID,
        handle: async (context) => {
          const actionPrefix = `${routePrefix}/`;
          if (!context.action.startsWith(actionPrefix)) {
            return null;
          }
          if (context.method !== "POST") {
            return context.json({ error: "Method not allowed" }, 405);
          }

          const pluginAction = context.action.slice(actionPrefix.length);
          const entry = routeEntries.get(pluginAction);
          if (!entry) {
            return null;
          }
          const payload = await context.readJson();
          const args = parsePluginArgs(payload);
          if (!args) {
            return context.json({ error: "Invalid request body" }, 400);
          }

          if (entry.kind === "query") {
            const result = await fetchers.fetchAuthQuery(
              entry.ref as FunctionReference<"query", "public">,
              args as FunctionArgs<FunctionReference<"query", "public">>
            );
            return context.json(result);
          }
          if (entry.kind === "mutation") {
            const result = await fetchers.fetchAuthMutation(
              entry.ref as FunctionReference<"mutation", "public">,
              args as FunctionArgs<FunctionReference<"mutation", "public">>
            );
            return context.json(result);
          }

          const result = await fetchers.fetchAuthAction(
            entry.ref as FunctionReference<"action", "public">,
            args as FunctionArgs<FunctionReference<"action", "public">>
          );
          return context.json(result);
        },
      };
    },
  };
}
