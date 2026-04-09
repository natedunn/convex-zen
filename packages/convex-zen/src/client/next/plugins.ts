import type { FunctionArgs, FunctionReference } from "convex/server";
import type {
  AuthCoreMeta,
  AuthMeta,
  AuthPluginFunctionKind,
  AuthPluginMeta,
} from "../plugin-meta.js";
import { toKebabCase } from "../plugin-meta.js";
import type {
  NextServerAuth,
  NextConvexFetchers,
  NextConvexActionRefs,
  NextConvexActions,
  NextConvexAuthServerOptions,
} from "./index.js";
import {
  type ConvexRouteFunctionRef,
  hasFunctionRefCandidate,
  readFunctionRef,
  readMember,
  isRecord,
} from "../helpers.js";

export interface NextAuthApiPluginContext {
  request: Request;
  method: string;
  action: string;
  readJson: () => Promise<unknown>;
  json: (data: unknown, status?: number) => Response;
}

export interface NextAuthApiPlugin {
  id: string;
  handle: (
    context: NextAuthApiPluginContext
  ) => Promise<Response | null> | Response | null;
}

export interface NextAuthApiPluginFactoryContext {
  nextAuth: NextServerAuth;
  fetchers: NextConvexFetchers;
  convexFunctions: Record<string, unknown>;
}

export interface NextAuthApiPluginFactory {
  create: (
    context: NextAuthApiPluginFactoryContext
  ) => NextAuthApiPlugin;
}

export type NextAuthApiPluginSelection =
  | "auto"
  | readonly NextAuthApiPluginFactory[];

export type NextAuthFunctionKind = AuthPluginFunctionKind;
export type NextAuthCoreMeta = AuthCoreMeta;
export type NextAuthPluginMeta = AuthPluginMeta;
export type NextAuthMeta = AuthMeta;

export function resolveNamedConvexFunctionRef(
  convexFunctions: NextConvexActionRefs,
  name: string,
  group?: string
): unknown {
  if (group) {
    const groupedCandidate = readMember(readMember(convexFunctions, group), name);
    if (hasFunctionRefCandidate(groupedCandidate)) {
      return groupedCandidate;
    }
  }
  const rootCandidate = readMember(convexFunctions, name);
  if (hasFunctionRefCandidate(rootCandidate)) {
    return rootCandidate;
  }
  return undefined;
}

export function asMutationActionRef(
  value: unknown,
  actionName: "signInWithEmail" | "validateSession" | "invalidateSession"
): FunctionReference<"mutation", "public"> {
  if (!hasFunctionRefCandidate(value)) {
    throw new Error(
      `createNextConvexAuth could not resolve "${actionName}" function. ` +
        `Pass flat convexFunctions ({ ${actionName}, ... }) or nested convexFunctions ({ core: { ${actionName}, ... } }).`
    );
  }
  return value as FunctionReference<"mutation", "public">;
}

export function resolveCoreActions(
  convexFunctions: NextConvexActionRefs
): NextConvexActions {
  return {
    signInWithEmail: asMutationActionRef(
      resolveNamedConvexFunctionRef(convexFunctions, "signInWithEmail", "core"),
      "signInWithEmail"
    ),
    validateSession: asMutationActionRef(
      resolveNamedConvexFunctionRef(convexFunctions, "validateSession", "core"),
      "validateSession"
    ),
    invalidateSession: asMutationActionRef(
      resolveNamedConvexFunctionRef(convexFunctions, "invalidateSession", "core"),
      "invalidateSession"
    ),
  };
}

type NextCoreRouteEntry = {
  kind?: NextAuthFunctionKind;
  ref: ConvexRouteFunctionRef;
};

type NextPluginRouteEntry = {
  kind: NextAuthFunctionKind;
  ref: ConvexRouteFunctionRef;
};

const NEXT_CORE_API_PLUGIN_ID = "core" as const;
const NEXT_PLUGIN_API_PLUGIN_ID = "plugin" as const;

export function hasPluginMeta(pluginMeta: NextAuthPluginMeta | undefined): boolean {
  if (!pluginMeta) {
    return false;
  }
  for (const pluginFunctions of Object.values(pluginMeta)) {
    if (Object.keys(pluginFunctions).length > 0) {
      return true;
    }
  }
  return false;
}

export function resolvePluginMeta(
  options: Pick<NextConvexAuthServerOptions, "meta" | "pluginMeta">
): NextAuthPluginMeta | undefined {
  return options.meta?.plugin ?? options.pluginMeta;
}

export function resolveCoreMeta(
  options: Pick<NextConvexAuthServerOptions, "meta" | "coreMeta">
): NextAuthCoreMeta | undefined {
  return options.meta?.core ?? options.coreMeta;
}

function parseObjectPayload(value: unknown): Record<string, unknown> | null {
  if (value === null || value === undefined) {
    return {};
  }
  return isRecord(value) ? value : null;
}

function resolveCoreRouteEntries(
  coreMeta: NextAuthCoreMeta | undefined,
  convexFunctions: Record<string, unknown>
): Map<string, NextCoreRouteEntry> {
  const entries = new Map<string, NextCoreRouteEntry>();
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
        `createNextAuthServer found duplicate core route mapping for "${routeKey}".`
      );
    }

    const functionRef = readFunctionRef<ConvexRouteFunctionRef>(
      readMember(coreRoot, functionName)
    );
    if (!functionRef) {
      if (coreMeta) {
        throw new Error(
          `createNextAuthServer could not resolve "convexFunctions.core.${functionName}".`
        );
      }
      continue;
    }

    const functionKind = coreMeta?.[functionName];
    entries.set(routeKey, {
      ...(functionKind !== undefined ? { kind: functionKind } : {}),
      ref: functionRef,
    });
  }

  return entries;
}

function resolvePluginRouteEntries(
  pluginMeta: NextAuthPluginMeta,
  convexFunctions: Record<string, unknown>
): Map<string, NextPluginRouteEntry> {
  const entries = new Map<string, NextPluginRouteEntry>();
  const pluginRoot = readMember(convexFunctions, "plugin");

  for (const [pluginName, pluginFunctions] of Object.entries(pluginMeta)) {
    for (const [functionName, functionKind] of Object.entries(pluginFunctions)) {
      const routeKey = `${toKebabCase(pluginName)}/${toKebabCase(functionName)}`;
      if (entries.has(routeKey)) {
        throw new Error(
          `createNextAuthServer found duplicate plugin route mapping for "${routeKey}".`
        );
      }

      const functionRef = readFunctionRef<ConvexRouteFunctionRef>(
        readMember(readMember(pluginRoot, pluginName), functionName)
      );
      if (!functionRef) {
        throw new Error(
          `createNextAuthServer could not resolve "convexFunctions.plugin.${pluginName}.${functionName}".`
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

function isUnauthorizedCoreRouteError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const message = error.message.toLowerCase();
  return message.includes("unauthorized") || message.includes("forbidden");
}

function isProductionRuntime(): boolean {
  const env = (
    globalThis as { process?: { env?: Record<string, string | undefined> } }
  ).process?.env;
  return env?.NODE_ENV === "production";
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
    "[convex-zen] next core/current-user auth bridge failed (unauthorized). Returning null.",
    details
  );
}

function createNextCoreApiPlugin(options: {
  coreMeta?: NextAuthCoreMeta;
  convexFunctions: Record<string, unknown>;
  fetchers: NextConvexFetchers;
}): NextAuthApiPlugin {
  const routeEntries = resolveCoreRouteEntries(
    options.coreMeta,
    options.convexFunctions
  );

  return {
    id: NEXT_CORE_API_PLUGIN_ID,
    handle: async (context) => {
      const actionPrefix = "core/";
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
      const args = parseObjectPayload(payload);
      if (!args) {
        return context.json({ error: "Invalid request body" }, 400);
      }

      if (coreAction === "current-user") {
        try {
          const result = await options.fetchers.fetchAuthQuery(
            context.request,
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

      if (entry.kind === "query") {
        const result = await options.fetchers.fetchAuthQuery(
          context.request,
          entry.ref as FunctionReference<"query", "public">,
          args as FunctionArgs<FunctionReference<"query", "public">>
        );
        return context.json(result);
      }
      if (entry.kind === "mutation") {
        const result = await options.fetchers.fetchAuthMutation(
          context.request,
          entry.ref as FunctionReference<"mutation", "public">,
          args as FunctionArgs<FunctionReference<"mutation", "public">>
        );
        return context.json(result);
      }
      if (entry.kind === "action") {
        const result = await options.fetchers.fetchAuthAction(
          context.request,
          entry.ref as FunctionReference<"action", "public">,
          args as FunctionArgs<FunctionReference<"action", "public">>
        );
        return context.json(result);
      }

      try {
        const result = await options.fetchers.fetchAuthMutation(
          context.request,
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
        const result = await options.fetchers.fetchAuthQuery(
          context.request,
          entry.ref as FunctionReference<"query", "public">,
          args as FunctionArgs<FunctionReference<"query", "public">>
        );
        return context.json(result);
      } catch (queryError) {
        if (!shouldTryNextCoreKind(queryError)) {
          throw queryError;
        }
      }

      const result = await options.fetchers.fetchAuthAction(
        context.request,
        entry.ref as FunctionReference<"action", "public">,
        args as FunctionArgs<FunctionReference<"action", "public">>
      );
      return context.json(result);
    },
  };
}

function createNextPluginApiPlugin(options: {
  pluginMeta: NextAuthPluginMeta;
  convexFunctions: Record<string, unknown>;
  fetchers: NextConvexFetchers;
}): NextAuthApiPlugin {
  const routeEntries = resolvePluginRouteEntries(
    options.pluginMeta,
    options.convexFunctions
  );

  return {
    id: NEXT_PLUGIN_API_PLUGIN_ID,
    handle: async (context) => {
      const actionPrefix = "plugin/";
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
      const args = parseObjectPayload(payload);
      if (!args) {
        return context.json({ error: "Invalid request body" }, 400);
      }

      if (entry.kind === "query") {
        const result = await options.fetchers.fetchAuthQuery(
          context.request,
          entry.ref as FunctionReference<"query", "public">,
          args as FunctionArgs<FunctionReference<"query", "public">>
        );
        return context.json(result);
      }
      if (entry.kind === "mutation") {
        const result = await options.fetchers.fetchAuthMutation(
          context.request,
          entry.ref as FunctionReference<"mutation", "public">,
          args as FunctionArgs<FunctionReference<"mutation", "public">>
        );
        return context.json(result);
      }

      const result = await options.fetchers.fetchAuthAction(
        context.request,
        entry.ref as FunctionReference<"action", "public">,
        args as FunctionArgs<FunctionReference<"action", "public">>
      );
      return context.json(result);
    },
  };
}

/**
 * Add generic core auth API routes to Next auth handlers.
 */
export function coreApiPlugin(options: {
  coreMeta?: NextAuthCoreMeta;
} = {}): NextAuthApiPluginFactory {
  return {
    create: ({ convexFunctions, fetchers }) => {
      return createNextCoreApiPlugin({
        ...(options.coreMeta !== undefined ? { coreMeta: options.coreMeta } : {}),
        convexFunctions,
        fetchers,
      });
    },
  };
}

/**
 * Add generic plugin auth API routes to Next auth handlers.
 */
export function pluginApiPlugin(options: {
  pluginMeta: NextAuthPluginMeta;
}): NextAuthApiPluginFactory {
  return {
    create: ({ convexFunctions, fetchers }) => {
      return createNextPluginApiPlugin({
        pluginMeta: options.pluginMeta,
        convexFunctions,
        fetchers,
      });
    },
  };
}
