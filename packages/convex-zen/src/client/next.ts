import { ConvexHttpClient } from "convex/browser";
import { getFunctionName } from "convex/server";
import type {
  FunctionArgs,
  FunctionReference,
  FunctionReturnType,
} from "convex/server";
import {
  createRouteAuthRuntimeAdapter,
  type RouteAuthRuntimeAdapterClient,
  type RouteAuthRuntimeAdapterOptions,
} from "./framework-adapter";
import { createConvexFetchers } from "./convex-fetchers";
import {
  createSessionPrimitives,
  type SessionInfo,
  type SessionPrimitives,
  type SignInInput,
  type SignInOutput,
} from "./primitives";
import type { ReactAuthClient } from "./react";
import type { OAuthProviderId } from "../types";
import {
  type TanStackAuthCoreMeta,
  type TanStackAuthMeta,
  type TanStackAuthPluginFunctionKind,
  type TanStackAuthPluginMeta,
  toKebabCase,
} from "./tanstack-start-plugin-meta";
import {
  createConvexZenIdentityJwt,
  type SessionTokenCodec,
} from "./tanstack-start-identity-jwt";
import {
  type TanStackQueryAuthClient,
  type TanStackQueryAuthClientOptions,
  type TanStackStartAuthApiClientPlugin,
  type TanStackStartAuthApiClientPluginContext,
} from "./tanstack-start-client";

type MaybePromise<T> = T | Promise<T>;
const DEFAULT_COOKIE_MAX_AGE_SECONDS = 14 * 24 * 60 * 60;

export interface NextAuthClientOptions extends RouteAuthRuntimeAdapterOptions {}

export type NextQueryAuthClientOptions<
  TPlugins extends readonly TanStackStartAuthApiClientPlugin<object>[] = [],
  TConvexFunctions extends Record<string, unknown> = Record<string, unknown>,
  TPluginMeta extends TanStackAuthPluginMeta = TanStackAuthPluginMeta,
  TCoreMeta extends TanStackAuthCoreMeta = TanStackAuthCoreMeta,
> = TanStackQueryAuthClientOptions<
  TPlugins,
  TConvexFunctions,
  TPluginMeta,
  TCoreMeta
>;

export type NextQueryAuthClient<
  TPlugins extends readonly TanStackStartAuthApiClientPlugin<object>[] = [],
  TConvexFunctions extends Record<string, unknown> = Record<string, unknown>,
  TPluginMeta extends TanStackAuthPluginMeta = TanStackAuthPluginMeta,
  TCoreMeta extends TanStackAuthCoreMeta = TanStackAuthCoreMeta,
> = TanStackQueryAuthClient<
  TPlugins,
  TConvexFunctions,
  TPluginMeta,
  TCoreMeta
>;

export interface NextAuthServerFns {
  getSession: () => Promise<SessionInfo | null>;
}

export type NextCookieSameSite = "lax" | "strict" | "none";

export interface NextCookieOptions {
  path?: string;
  domain?: string;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: NextCookieSameSite;
  maxAge?: number;
}

export interface AuthenticatedSession {
  token: string;
  session: SessionInfo;
}

export interface NextServerAuthOptions {
  primitives: SessionPrimitives;
  cookieName?: string;
  cookieOptions?: Partial<NextCookieOptions>;
  sessionTokenCodec?: SessionTokenCodec;
}

export interface NextSignInResult {
  session: SessionInfo;
  token: string;
  setCookie: string;
}

export interface NextSignOutResult {
  clearCookie: string;
}

export interface NextServerAuth {
  getSession: (request: Request) => Promise<SessionInfo | null>;
  getToken: (request: Request) => Promise<string | null>;
  signIn: (input: SignInInput) => Promise<NextSignInResult>;
  establishSession: (sessionToken: string) => Promise<NextSignInResult>;
  signOut: (request: Request) => Promise<NextSignOutResult>;
  requireSession: (request: Request) => Promise<AuthenticatedSession>;
  withSession: <T>(
    request: Request,
    handler: (auth: AuthenticatedSession) => Promise<T>
  ) => Promise<T>;
}

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

export type NextAuthFunctionKind = TanStackAuthPluginFunctionKind;
export type NextAuthCoreMeta = TanStackAuthCoreMeta;
export type NextAuthPluginMeta = TanStackAuthPluginMeta;
export type NextAuthMeta = TanStackAuthMeta;

export interface NextConvexFetchers {
  fetchQuery: <Query extends FunctionReference<"query", "public">>(
    fn: Query,
    args: FunctionArgs<Query>
  ) => Promise<FunctionReturnType<Query>>;
  fetchMutation: <Mutation extends FunctionReference<"mutation", "public">>(
    fn: Mutation,
    args: FunctionArgs<Mutation>
  ) => Promise<FunctionReturnType<Mutation>>;
  fetchAction: <Action extends FunctionReference<"action", "public">>(
    fn: Action,
    args: FunctionArgs<Action>
  ) => Promise<FunctionReturnType<Action>>;
  fetchAuthQuery: <Query extends FunctionReference<"query", "public">>(
    request: Request,
    fn: Query,
    args: FunctionArgs<Query>
  ) => Promise<FunctionReturnType<Query>>;
  fetchAuthMutation: <Mutation extends FunctionReference<"mutation", "public">>(
    request: Request,
    fn: Mutation,
    args: FunctionArgs<Mutation>
  ) => Promise<FunctionReturnType<Mutation>>;
  fetchAuthAction: <Action extends FunctionReference<"action", "public">>(
    request: Request,
    fn: Action,
    args: FunctionArgs<Action>
  ) => Promise<FunctionReturnType<Action>>;
}

export interface NextServerFetchOptions {
  pathname?: string;
}

export type NextServerAuthFetcher<
  FnType extends "query" | "mutation" | "action",
> = {
  <Fn extends FunctionReference<FnType, "public">>(
    request: Request,
    fn: Fn,
    args: FunctionArgs<Fn>
  ): Promise<FunctionReturnType<Fn>>;
  <Fn extends FunctionReference<FnType, "public">>(
    fn: Fn,
    args: FunctionArgs<Fn>,
    options?: NextServerFetchOptions
  ): Promise<FunctionReturnType<Fn>>;
};

export type NextServerAuthQueryFetcher = NextServerAuthFetcher<"query">;
export type NextServerAuthMutationFetcher = NextServerAuthFetcher<"mutation">;
export type NextServerAuthActionFetcher = NextServerAuthFetcher<"action">;

export interface NextConvexFetchersOptions {
  nextAuth: Pick<NextServerAuth, "requireSession">;
  convexUrl: string;
}

export type NextTrustedOriginsConfig =
  | readonly string[]
  | ((request: Request) => MaybePromise<readonly string[]>);

export type NextTrustedProxyConfig =
  | boolean
  | ((request: Request) => boolean);

export interface NextResolveClientIpContext {
  trustProxy: boolean;
  readForwardedIp: () => string | undefined;
  readRealIp: () => string | undefined;
}

export type NextClientIpResolver = (
  request: Request,
  context: NextResolveClientIpContext
) => string | undefined;

export interface NextAuthApiHandlerOptions {
  nextAuth: Pick<
    NextServerAuth,
    "getSession" | "getToken" | "signIn" | "establishSession" | "signOut"
  >;
  basePath?: string;
  plugins?: readonly NextAuthApiPlugin[];
  trustedOrigins?: NextTrustedOriginsConfig;
  trustedProxy?: NextTrustedProxyConfig;
  getClientIp?: NextClientIpResolver;
  convexFunctions?: Record<string, unknown>;
  coreMeta?: NextAuthCoreMeta;
  fetchers?: Pick<NextConvexFetchers, "fetchAction" | "fetchMutation">;
}

export interface NextAuthServerOptions
  extends NextServerAuthOptions,
    Omit<NextAuthApiHandlerOptions, "nextAuth"> {}

export interface NextAuthServer extends NextServerAuth {
  handler: (request: Request) => Promise<Response>;
}

export interface NextConvexActions {
  signInWithEmail: FunctionReference<"mutation", "public">;
  validateSession: FunctionReference<"mutation", "public">;
  invalidateSession: FunctionReference<"mutation", "public">;
}

export type NextConvexActionRefs =
  | NextConvexActions
  | ({
      core: NextConvexActions;
    } & Record<string, unknown>);

export interface NextConvexAuthOptions {
  convexUrl: string;
  convexFunctions: NextConvexActionRefs;
  cookieName?: string;
  cookieOptions?: Partial<NextCookieOptions>;
  sessionTokenCodec?: SessionTokenCodec;
}

export interface NextConvexAuthServerOptions
  extends NextConvexAuthOptions,
    Omit<
      NextAuthApiHandlerOptions,
      "nextAuth" | "plugins" | "convexFunctions" | "coreMeta" | "fetchers"
    > {
  plugins?: NextAuthApiPluginSelection;
  pluginMeta?: NextAuthPluginMeta;
  coreMeta?: NextAuthCoreMeta;
  meta?: NextAuthMeta;
  trustedOriginsFromEnv?: false | NextTrustedOriginsFromEnvOptions;
}

export interface NextConvexAuthServer extends NextAuthServer {
  getSession: NextServerGetSession;
  fetchQuery: <Query extends FunctionReference<"query", "public">>(
    fn: Query,
    args: FunctionArgs<Query>
  ) => Promise<FunctionReturnType<Query>>;
  fetchMutation: <Mutation extends FunctionReference<"mutation", "public">>(
    fn: Mutation,
    args: FunctionArgs<Mutation>
  ) => Promise<FunctionReturnType<Mutation>>;
  fetchAction: <Action extends FunctionReference<"action", "public">>(
    fn: Action,
    args: FunctionArgs<Action>
  ) => Promise<FunctionReturnType<Action>>;
  fetchAuthQuery: NextServerAuthQueryFetcher;
  fetchAuthMutation: NextServerAuthMutationFetcher;
  fetchAuthAction: NextServerAuthActionFetcher;
  getToken: NextServerGetToken;
  isAuthenticated: (pathname?: string) => Promise<boolean>;
}

export type NextServerGetToken = (
  (request: Request) => Promise<string | null>
) &
  ((pathname?: string) => Promise<string | null>);

export type NextServerGetSession = (
  (request: Request) => Promise<SessionInfo | null>
) &
  ((pathname?: string) => Promise<SessionInfo | null>);

export interface NextTrustedOriginsFromEnvOptions {
  env?: Record<string, string | undefined>;
  envVars?: readonly string[];
  defaults?: readonly string[];
}

export interface NextConvexAuthServerFactoryOptions
  extends Omit<
    NextConvexAuthServerOptions,
    "convexUrl" | "trustedOrigins" | "trustedOriginsFromEnv"
  > {
  trustedOrigins?: NextTrustedOriginsConfig;
  trustedOriginsFromEnv?: false | NextTrustedOriginsFromEnvOptions;
  env?: Record<string, string | undefined>;
  convexUrlEnvVar?: string;
}

export interface NextConvexAuthServerFactory {
  getAuthServer: () => NextConvexAuthServer | null;
  getInitError: () => Error | null;
  handler: (request: Request) => Promise<Response>;
  getSession: NextServerGetSession;
  getToken: NextServerGetToken;
  isAuthenticated: (pathname?: string) => Promise<boolean>;
  requireSession: (request: Request) => Promise<AuthenticatedSession>;
  fetchQuery: <Query extends FunctionReference<"query", "public">>(
    fn: Query,
    args: FunctionArgs<Query>
  ) => Promise<FunctionReturnType<Query>>;
  fetchMutation: <Mutation extends FunctionReference<"mutation", "public">>(
    fn: Mutation,
    args: FunctionArgs<Mutation>
  ) => Promise<FunctionReturnType<Mutation>>;
  fetchAction: <Action extends FunctionReference<"action", "public">>(
    fn: Action,
    args: FunctionArgs<Action>
  ) => Promise<FunctionReturnType<Action>>;
  fetchAuthQuery: NextServerAuthQueryFetcher;
  fetchAuthMutation: NextServerAuthMutationFetcher;
  fetchAuthAction: NextServerAuthActionFetcher;
}

export interface NextRequestFromHeadersOptions {
  headers: Headers;
  pathname?: string;
  fallbackHost?: string;
  fallbackProtocol?: "http" | "https";
}

interface NextAuthErrorPayload {
  error?: string;
}

type NextOAuthActionRefs = {
  getOAuthUrl: FunctionReference<"mutation", "public">;
  handleOAuthCallback: FunctionReference<"action", "public">;
};

type NextOAuthStateCookiePayload = {
  state: string;
  providerId: OAuthProviderId;
  redirectTo: string;
  errorRedirectTo: string;
};

type NextOAuthCallbackResult = {
  sessionToken?: unknown;
  redirectTo?: unknown;
  redirectUrl?: unknown;
};

const NEXT_OAUTH_STATE_COOKIE_NAME = "cz_oauth_state";
const NEXT_OAUTH_STATE_COOKIE_MAX_AGE_SECONDS = 10 * 60;

/**
 * Build a Request from forwarded host/proto headers (useful in Next server components).
 */
export function createRequestFromHeaders(
  options: NextRequestFromHeadersOptions
): Request {
  const forwardedHost = options.headers.get("x-forwarded-host");
  const host =
    forwardedHost ?? options.headers.get("host") ?? options.fallbackHost ?? "localhost:3000";

  const forwardedProto = options.headers.get("x-forwarded-proto");
  const protocol =
    forwardedProto ??
    options.fallbackProtocol ??
    (host.includes("localhost") || host.startsWith("127.0.0.1")
      ? "http"
      : "https");

  const safePath = (options.pathname ?? "/").startsWith("/")
    ? options.pathname ?? "/"
    : `/${options.pathname}`;

  return new Request(`${protocol}://${host}${safePath}`, {
    method: "GET",
    headers: options.headers,
  });
}

type NextHeadersModule = {
  headers?: () => Headers | Promise<Headers>;
};

async function createRequestFromNextHeaders(pathname = "/"): Promise<Request> {
  const moduleValue = (await import("next/headers")) as NextHeadersModule;
  const headersFn = moduleValue.headers;
  if (typeof headersFn !== "function") {
    throw new Error(
      "[convex-zen/next] next/headers.headers() is unavailable. Call this helper from Next.js server code."
    );
  }
  return createRequestFromHeaders({
    headers: await headersFn(),
    pathname,
  });
}

function createNextIsAuthenticated(
  requireSession: (request: Request) => Promise<AuthenticatedSession>
): (pathname?: string) => Promise<boolean> {
  return async (pathname = "/"): Promise<boolean> => {
    try {
      await requireSession(await createRequestFromNextHeaders(pathname));
      return true;
    } catch {
      return false;
    }
  };
}

function createNextGetToken(
  getTokenWithRequest: (request: Request) => Promise<string | null>
): NextServerGetToken {
  const getToken = async (
    requestOrPath?: Request | string
  ): Promise<string | null> => {
    if (requestOrPath instanceof Request) {
      return getTokenWithRequest(requestOrPath);
    }
    const pathname = typeof requestOrPath === "string" ? requestOrPath : "/";
    return getTokenWithRequest(await createRequestFromNextHeaders(pathname));
  };
  return getToken as NextServerGetToken;
}

function createNextGetSession(
  getSessionWithRequest: (request: Request) => Promise<SessionInfo | null>
): NextServerGetSession {
  const getSession = async (
    requestOrPath?: Request | string
  ): Promise<SessionInfo | null> => {
    if (requestOrPath instanceof Request) {
      return getSessionWithRequest(requestOrPath);
    }
    const pathname = typeof requestOrPath === "string" ? requestOrPath : "/";
    return getSessionWithRequest(await createRequestFromNextHeaders(pathname));
  };
  return getSession as NextServerGetSession;
}

function createNextServerAuthFetcher<
  FnType extends "query" | "mutation" | "action",
>(
  fetcherWithRequest: <
    Fn extends FunctionReference<FnType, "public">,
  >(
    request: Request,
    fn: Fn,
    args: FunctionArgs<Fn>
  ) => Promise<FunctionReturnType<Fn>>
): NextServerAuthFetcher<FnType> {
  const fetcher = async <Fn extends FunctionReference<FnType, "public">>(
    requestOrFn: Request | Fn,
    fnOrArgs: Fn | FunctionArgs<Fn>,
    argsOrOptions?: FunctionArgs<Fn> | NextServerFetchOptions
  ): Promise<FunctionReturnType<Fn>> => {
    if (requestOrFn instanceof Request) {
      return fetcherWithRequest(
        requestOrFn,
        fnOrArgs as Fn,
        argsOrOptions as FunctionArgs<Fn>
      );
    }

    const fn = requestOrFn;
    const args = fnOrArgs as FunctionArgs<Fn>;
    const options = (argsOrOptions ?? {}) as NextServerFetchOptions;
    const request = await createRequestFromNextHeaders(options.pathname ?? "/");
    return fetcherWithRequest(request, fn, args);
  };

  return fetcher as NextServerAuthFetcher<FnType>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function hasFunctionRefCandidate(value: unknown): boolean {
  return (
    value !== null &&
    (typeof value === "object" || typeof value === "function")
  );
}

function readMember(source: unknown, key: string): unknown {
  if (
    source === null ||
    (typeof source !== "object" && typeof source !== "function")
  ) {
    return undefined;
  }
  return (source as Record<string, unknown>)[key];
}

function resolveNamedConvexFunctionRef(
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

function asMutationActionRef(
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

function resolveCoreActions(
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

type ConvexRouteFunctionRef = FunctionReference<
  "query" | "mutation" | "action",
  "public"
>;

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

function readFunctionRef<T extends ConvexRouteFunctionRef>(value: unknown): T | null {
  if (!value || (typeof value !== "object" && typeof value !== "function")) {
    return null;
  }
  return value as T;
}

function hasPluginMeta(pluginMeta: NextAuthPluginMeta | undefined): boolean {
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

function resolvePluginMeta(
  options: Pick<NextConvexAuthServerOptions, "meta" | "pluginMeta">
): NextAuthPluginMeta | undefined {
  return options.meta?.plugin ?? options.pluginMeta;
}

function resolveCoreMeta(
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

function isProductionRuntime(): boolean {
  const env = (
    globalThis as { process?: { env?: Record<string, string | undefined> } }
  ).process?.env;
  return env?.NODE_ENV === "production";
}

function resolveCookieOptions(
  options?: Partial<NextCookieOptions>
): NextCookieOptions {
  return {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: isProductionRuntime(),
    maxAge: DEFAULT_COOKIE_MAX_AGE_SECONDS,
    ...options,
  };
}

function serializeCookie(name: string, value: string, options: NextCookieOptions): string {
  const segments = [`${name}=${encodeURIComponent(value)}`];

  const path = options.path ?? "/";
  segments.push(`Path=${path}`);

  if (options.domain) {
    segments.push(`Domain=${options.domain}`);
  }

  if (options.maxAge !== undefined) {
    segments.push(`Max-Age=${Math.max(0, Math.floor(options.maxAge))}`);
  }

  if (options.httpOnly !== false) {
    segments.push("HttpOnly");
  }

  if (options.secure) {
    segments.push("Secure");
  }

  if (options.sameSite) {
    segments.push(`SameSite=${options.sameSite}`);
  }

  return segments.join("; ");
}

function parseCookieHeader(cookieHeader: string | null): Map<string, string> {
  const parsed = new Map<string, string>();
  if (!cookieHeader) {
    return parsed;
  }

  const parts = cookieHeader.split(";");
  for (const part of parts) {
    const [rawName, ...valueParts] = part.trim().split("=");
    if (!rawName || valueParts.length === 0) {
      continue;
    }
    const rawValue = valueParts.join("=");
    try {
      parsed.set(rawName, decodeURIComponent(rawValue));
    } catch {
      parsed.set(rawName, rawValue);
    }
  }

  return parsed;
}

function readCookie(request: Request, name: string): string | null {
  const cookies = parseCookieHeader(request.headers.get("cookie"));
  return cookies.get(name) ?? null;
}

function isOAuthProviderId(value: string): value is OAuthProviderId {
  return value.trim().length > 0;
}

function asPublicMutationRef(
  value: unknown
): FunctionReference<"mutation", "public"> | null {
  return hasFunctionRefCandidate(value)
    ? (value as FunctionReference<"mutation", "public">)
    : null;
}

function asPublicActionRef(
  value: unknown
): FunctionReference<"action", "public"> | null {
  return hasFunctionRefCandidate(value)
    ? (value as FunctionReference<"action", "public">)
    : null;
}

function resolveOAuthActionRefs(
  convexFunctions: Record<string, unknown> | undefined
): NextOAuthActionRefs | null {
  if (!convexFunctions) {
    return null;
  }

  const getOAuthUrl = asPublicMutationRef(
    resolveNamedConvexFunctionRef(
      convexFunctions as NextConvexActionRefs,
      "getOAuthUrl",
      "core"
    )
  );
  const handleOAuthCallback = asPublicActionRef(
    resolveNamedConvexFunctionRef(
      convexFunctions as NextConvexActionRefs,
      "handleOAuthCallback",
      "core"
    )
  );

  if (!getOAuthUrl || !handleOAuthCallback) {
    return null;
  }

  return {
    getOAuthUrl,
    handleOAuthCallback,
  };
}

function buildNextOAuthCallbackUrl(
  request: Request,
  basePath: string,
  providerId: OAuthProviderId
): string {
  const requestUrl = new URL(request.url);
  return new URL(`${basePath}/callback/${providerId}`, requestUrl).toString();
}

function parseOAuthStateCookie(
  request: Request
): NextOAuthStateCookiePayload | null {
  const rawCookie = readCookie(request, NEXT_OAUTH_STATE_COOKIE_NAME);
  if (!rawCookie) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawCookie) as {
      state?: unknown;
      providerId?: unknown;
      redirectTo?: unknown;
      errorRedirectTo?: unknown;
    };
    if (
      typeof parsed.state !== "string" ||
      typeof parsed.providerId !== "string" ||
      !isOAuthProviderId(parsed.providerId) ||
      typeof parsed.redirectTo !== "string" ||
      typeof parsed.errorRedirectTo !== "string"
    ) {
      return null;
    }

    return {
      state: parsed.state,
      providerId: parsed.providerId,
      redirectTo: parsed.redirectTo,
      errorRedirectTo: parsed.errorRedirectTo,
    };
  } catch {
    return null;
  }
}

function serializeOAuthStateCookie(
  basePath: string,
  payload: NextOAuthStateCookiePayload
): string {
  return serializeCookie(
    NEXT_OAUTH_STATE_COOKIE_NAME,
    JSON.stringify(payload),
    resolveCookieOptions({
      path: basePath,
      maxAge: NEXT_OAUTH_STATE_COOKIE_MAX_AGE_SECONDS,
    })
  );
}

function clearOAuthStateCookie(basePath: string): string {
  return serializeCookie(NEXT_OAUTH_STATE_COOKIE_NAME, "", {
    path: basePath,
    httpOnly: true,
    sameSite: "lax",
    secure: isProductionRuntime(),
    maxAge: 0,
  });
}

function appendSetCookieHeaders(headers: Headers, cookies: readonly string[]): void {
  for (const cookie of cookies) {
    headers.append("set-cookie", cookie);
  }
}

function createRedirectResponse(
  request: Request,
  location: string,
  setCookies: readonly string[] = []
): Response {
  const headers = new Headers({
    location: new URL(location, request.url).toString(),
  });
  appendSetCookieHeaders(headers, setCookies);
  return new Response(null, {
    status: 302,
    headers,
  });
}

function appendOAuthErrorParams(
  target: URL,
  error: string,
  providerId: OAuthProviderId,
  description?: string
): URL {
  target.searchParams.set("error", error);
  target.searchParams.set("provider", providerId);
  if (description) {
    target.searchParams.set("error_description", description);
  }
  return target;
}

function mapOAuthErrorCode(error: unknown): string {
  if (!(error instanceof Error)) {
    return "oauth_callback_error";
  }
  const message = error.message.toLowerCase();
  if (message.includes("invalid or expired oauth state")) {
    return "oauth_invalid_state";
  }
  if (message.includes("provider mismatch")) {
    return "oauth_invalid_state";
  }
  if (message.includes("trusted email linking")) {
    return "oauth_link_required";
  }
  if (message.includes("verified email")) {
    return "oauth_unverified_email";
  }
  if (message.includes("email") && message.includes("not found")) {
    return "oauth_email_not_found";
  }
  if (message.includes("token exchange")) {
    return "oauth_token_exchange_failed";
  }
  if (message.includes("profile")) {
    return "oauth_profile_fetch_failed";
  }
  return "oauth_callback_error";
}

function parseAuthorizationUrlState(authorizationUrl: string): string | null {
  try {
    const state = new URL(authorizationUrl).searchParams.get("state");
    return state && state.length > 0 ? state : null;
  } catch {
    return null;
  }
}

function normalizeRedirectTarget(
  request: Request,
  target: string | null | undefined,
  fallback = "/"
): string {
  const resolvedTarget =
    typeof target === "string" && target.length > 0 ? target : fallback;
  if (resolvedTarget.startsWith("/") && !resolvedTarget.startsWith("//")) {
    return new URL(resolvedTarget, request.url).toString();
  }
  return new URL(fallback, request.url).toString();
}

function isSafeRedirectTarget(target: string | null | undefined): boolean {
  if (typeof target !== "string" || target.length === 0) {
    return true;
  }
  return target.startsWith("/") && !target.startsWith("//");
}

function createOAuthErrorRedirectResponse(args: {
  request: Request;
  providerId: OAuthProviderId;
  error: string;
  description?: string | undefined;
  target?: string | undefined;
  clearStateCookie?: boolean;
  basePath: string;
}): Response {
  const redirectTarget = new URL(
    normalizeRedirectTarget(args.request, args.target),
    args.request.url
  );
  appendOAuthErrorParams(
    redirectTarget,
    args.error,
    args.providerId,
    args.description
  );

  const cookies = args.clearStateCookie
    ? [clearOAuthStateCookie(args.basePath)]
    : [];
  return createRedirectResponse(
    args.request,
    redirectTarget.toString(),
    cookies
  );
}

function parseOAuthCallbackResult(value: unknown): NextOAuthCallbackResult | null {
  if (!isRecord(value)) {
    return null;
  }
  return value as NextOAuthCallbackResult;
}

function normalizeBasePath(path: string): string {
  const normalized = path.trim();
  if (normalized === "") {
    return "/api/auth";
  }
  const withLeadingSlash = normalized.startsWith("/")
    ? normalized
    : `/${normalized}`;
  if (withLeadingSlash.length > 1 && withLeadingSlash.endsWith("/")) {
    return withLeadingSlash.slice(0, -1);
  }
  return withLeadingSlash;
}

function resolveActionFromPath(pathname: string, basePath: string): string | null {
  if (pathname === basePath) {
    return null;
  }
  const expectedPrefix = `${basePath}/`;
  if (!pathname.startsWith(expectedPrefix)) {
    return null;
  }
  const action = pathname.slice(expectedPrefix.length);
  return action.length > 0 ? action : null;
}

function decodeBase64UrlToUtf8(input: string): string | null {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const remainder = normalized.length % 4;
  const padded =
    remainder === 0 ? normalized : normalized + "=".repeat(4 - remainder);
  try {
    if (typeof atob === "function") {
      return atob(padded);
    }
    const globalBuffer = (globalThis as { Buffer?: typeof Buffer }).Buffer;
    if (!globalBuffer) {
      return null;
    }
    return globalBuffer.from(padded, "base64").toString("utf8");
  } catch {
    return null;
  }
}

function extractJwtTokenMetadata(token: string): {
  issuedAtMs?: number;
  expiresAtMs?: number;
} {
  const segments = token.split(".");
  if (segments.length !== 3) {
    return {};
  }
  const payloadSegment = segments[1];
  if (!payloadSegment) {
    return {};
  }
  const decodedPayload = decodeBase64UrlToUtf8(payloadSegment);
  if (!decodedPayload) {
    return {};
  }
  try {
    const payload = JSON.parse(decodedPayload) as {
      iat?: unknown;
      exp?: unknown;
    };
    const metadata: {
      issuedAtMs?: number;
      expiresAtMs?: number;
    } = {};
    if (typeof payload.iat === "number" && Number.isFinite(payload.iat)) {
      metadata.issuedAtMs = Math.floor(payload.iat * 1000);
    }
    if (typeof payload.exp === "number" && Number.isFinite(payload.exp)) {
      metadata.expiresAtMs = Math.floor(payload.exp * 1000);
    }
    return metadata;
  } catch {
    return {};
  }
}

function normalizeOrigin(origin: string): string | null {
  try {
    return new URL(origin).origin;
  } catch {
    return null;
  }
}

function normalizeTrustedOriginValues(values: readonly string[]): string[] {
  const resolved = new Set<string>();
  for (const value of values) {
    const normalized = normalizeOrigin(value);
    if (normalized) {
      resolved.add(normalized);
    }
  }
  return [...resolved];
}

function resolveProcessEnv(): Record<string, string | undefined> {
  const env = (
    globalThis as { process?: { env?: Record<string, string | undefined> } }
  ).process?.env;
  return env ?? {};
}

function asError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  return new Error(
    typeof error === "string" ? error : "Next auth server initialization failed"
  );
}

function mergeTrustedOrigins(
  trustedOrigins: NextTrustedOriginsConfig | undefined,
  staticOrigins: readonly string[]
): NextTrustedOriginsConfig | undefined {
  if (staticOrigins.length === 0) {
    return trustedOrigins;
  }

  if (!trustedOrigins) {
    return [...staticOrigins];
  }

  if (typeof trustedOrigins === "function") {
    return async (request: Request) => {
      const resolved = await trustedOrigins(request);
      return [...staticOrigins, ...resolved];
    };
  }

  return [...staticOrigins, ...trustedOrigins];
}

/**
 * Resolve trusted auth origins from environment variables.
 *
 * Values can be absolute origins or URLs. Multiple values can be comma-separated.
 */
export function resolveNextTrustedOriginsFromEnv(
  options: NextTrustedOriginsFromEnvOptions = {}
): string[] {
  const env = options.env ?? resolveProcessEnv();
  const envVars = options.envVars ?? [
    "CONVEX_SITE_URL",
    "NEXT_PUBLIC_APP_ORIGIN",
    "PORTLESS_URL",
  ];
  const defaults = options.defaults ?? [];
  const values: string[] = [...defaults];

  for (const envVar of envVars) {
    const rawValue = env[envVar];
    if (!rawValue) {
      continue;
    }
    const parts = rawValue
      .split(",")
      .map((part) => part.trim())
      .filter((part) => part.length > 0);
    values.push(...parts);
  }

  return normalizeTrustedOriginValues(values);
}

async function resolveTrustedOrigins(
  request: Request,
  trustedOrigins: NextTrustedOriginsConfig | undefined
): Promise<Set<string>> {
  if (!trustedOrigins) {
    return new Set();
  }
  const values =
    typeof trustedOrigins === "function"
      ? await trustedOrigins(request)
      : trustedOrigins;
  const resolved = new Set<string>();
  for (const value of values) {
    const normalized = normalizeOrigin(value);
    if (normalized) {
      resolved.add(normalized);
    }
  }
  return resolved;
}

function sanitizeIpValue(rawValue: string | null | undefined): string | undefined {
  if (!rawValue) {
    return undefined;
  }
  let value = rawValue.trim();
  if (!value) {
    return undefined;
  }

  if (value.startsWith('"') && value.endsWith('"') && value.length > 1) {
    value = value.slice(1, -1).trim();
  }

  if (value.toLowerCase() === "unknown") {
    return undefined;
  }

  if (value.startsWith("[")) {
    const endBracket = value.indexOf("]");
    if (endBracket <= 1) {
      return undefined;
    }
    value = value.slice(1, endBracket);
  } else {
    const colonCount = (value.match(/:/g) ?? []).length;
    if (colonCount === 1) {
      const [host, port] = value.split(":");
      if (host && port && /^\d+$/.test(port)) {
        value = host;
      }
    }
  }

  if (value.length > 64) {
    return undefined;
  }

  if (!/^[A-Za-z0-9:.%_-]+$/.test(value)) {
    return undefined;
  }

  return value;
}

function readForwardedIp(request: Request): string | undefined {
  const forwarded = request.headers.get("forwarded");
  if (forwarded) {
    const firstEntry = forwarded.split(",")[0];
    if (firstEntry) {
      for (const segment of firstEntry.split(";")) {
        const [rawKey, rawValue] = segment.split("=", 2);
        if (!rawKey || !rawValue) {
          continue;
        }
        if (rawKey.trim().toLowerCase() !== "for") {
          continue;
        }
        const parsed = sanitizeIpValue(rawValue.trim());
        if (parsed) {
          return parsed;
        }
      }
    }
  }

  const xForwardedFor = request.headers.get("x-forwarded-for");
  if (!xForwardedFor) {
    return undefined;
  }
  const first = xForwardedFor.split(",")[0];
  return sanitizeIpValue(first);
}

function readRealIp(request: Request): string | undefined {
  return sanitizeIpValue(request.headers.get("x-real-ip"));
}

function shouldTrustProxy(
  request: Request,
  trustedProxy: NextTrustedProxyConfig | undefined
): boolean {
  if (typeof trustedProxy === "function") {
    return trustedProxy(request);
  }
  return trustedProxy === true;
}

function resolveClientIp(
  request: Request,
  options: Pick<NextAuthApiHandlerOptions, "trustedProxy" | "getClientIp">
): string | undefined {
  const trustProxy = shouldTrustProxy(request, options.trustedProxy);
  const resolverContext: NextResolveClientIpContext = {
    trustProxy,
    readForwardedIp: () => (trustProxy ? readForwardedIp(request) : undefined),
    readRealIp: () => (trustProxy ? readRealIp(request) : undefined),
  };

  const custom = options.getClientIp?.(request, resolverContext);
  const resolved = custom ?? resolverContext.readForwardedIp() ?? resolverContext.readRealIp();
  return sanitizeIpValue(resolved);
}

async function isAllowedOriginRequest(
  request: Request,
  trustedOrigins: NextTrustedOriginsConfig | undefined
): Promise<boolean> {
  const originHeader = request.headers.get("origin");
  if (!originHeader) {
    return true;
  }
  try {
    const requestUrl = new URL(request.url);
    const originUrl = new URL(originHeader);
    if (requestUrl.origin === originUrl.origin) {
      return true;
    }
    const trusted = await resolveTrustedOrigins(request, trustedOrigins);
    return trusted.has(originUrl.origin);
  } catch {
    return false;
  }
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (
    error &&
    typeof error === "object" &&
    "error" in error &&
    typeof (error as NextAuthErrorPayload).error === "string"
  ) {
    return (error as NextAuthErrorPayload).error as string;
  }
  return "Authentication request failed";
}

function json(
  data: unknown,
  status = 200,
  headers?: Record<string, string>
): Response {
  const responseHeaders = new Headers({
    "content-type": "application/json; charset=utf-8",
    ...(headers ?? {}),
  });
  return new Response(JSON.stringify(data), {
    status,
    headers: responseHeaders,
  });
}

function jsonNoStore(
  data: unknown,
  status = 200,
  headers?: Record<string, string>
): Response {
  const responseHeaders = new Headers({
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    pragma: "no-cache",
    expires: "0",
    ...(headers ?? {}),
  });
  return new Response(JSON.stringify(data), {
    status,
    headers: responseHeaders,
  });
}

interface NextClientRequestFailureContext {
  fallback: string;
}

type NextClientRouteFunctionRef = FunctionReference<
  "query" | "mutation" | "action",
  "public"
>;

type NextClientMutableCallable = ((input?: unknown) => Promise<unknown>) &
  Record<string, unknown>;

interface NextClientQueryOptions<
  TFunctionRef extends FunctionReference<"query", "public">,
> {
  queryKey: ["convexAuthQuery", string | TFunctionRef, FunctionArgs<TFunctionRef>];
  queryFn?: (
    context: unknown
  ) => Promise<FunctionReturnType<TFunctionRef>> | FunctionReturnType<TFunctionRef>;
  staleTime: number;
}

interface NextClientActionOptions<
  TFunctionRef extends FunctionReference<"action", "public">,
> {
  queryKey: ["convexAction", string | TFunctionRef, FunctionArgs<TFunctionRef>];
  queryFn?: (
    context: unknown
  ) => Promise<FunctionReturnType<TFunctionRef>> | FunctionReturnType<TFunctionRef>;
  enabled?: boolean;
  staleTime: number;
}

interface NextClientQueryClientLike {
  prefetchQuery: (options: {
    queryKey: readonly unknown[];
    staleTime?: number;
    enabled?: boolean;
  }) => Promise<unknown>;
  ensureQueryData: <TData>(options: {
    queryKey: readonly unknown[];
    staleTime?: number;
    enabled?: boolean;
  }) => Promise<TData>;
}

interface NextClientMutationExecutorLike {
  mutation: <TFunctionRef extends FunctionReference<"mutation", "public">>(
    functionRef: TFunctionRef,
    args: FunctionArgs<TFunctionRef>
  ) => Promise<FunctionReturnType<TFunctionRef>>;
}

interface NextClientActionExecutorLike {
  action: <TFunctionRef extends FunctionReference<"action", "public">>(
    functionRef: TFunctionRef,
    args: FunctionArgs<TFunctionRef>
  ) => Promise<FunctionReturnType<TFunctionRef>>;
}

const NEXT_QUERY_KEY_PREFIX = "convexAuthQuery" as const;

const NEXT_RESERVED_CORE_ROOT_METHOD_NAMES = new Set([
  "getSession",
  "getToken",
  "clearToken",
  "connectConvexAuth",
  "signOut",
  "signIn",
  "plugin",
  "core",
]);

const NEXT_DEFAULT_GENERATED_CORE_META = {
  signUp: "mutation",
  signInWithEmail: "mutation",
  verifyEmail: "mutation",
  requestPasswordReset: "mutation",
  resetPassword: "mutation",
  invalidateSession: "mutation",
  validateSession: "mutation",
  currentUser: "query",
  getOAuthUrl: "mutation",
  handleOAuthCallback: "action",
} as const satisfies TanStackAuthCoreMeta;

function normalizeClientBasePath(path: string): string {
  const normalized = path.trim();
  if (normalized === "") {
    return "/api/auth";
  }

  if (normalized.startsWith("http://") || normalized.startsWith("https://")) {
    return normalized.length > 1 && normalized.endsWith("/")
      ? normalized.slice(0, -1)
      : normalized;
  }

  const withLeadingSlash = normalized.startsWith("/")
    ? normalized
    : `/${normalized}`;
  return withLeadingSlash.length > 1 && withLeadingSlash.endsWith("/")
    ? withLeadingSlash.slice(0, -1)
    : withLeadingSlash;
}

async function readClientJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function resolveClientPluginMeta(options: {
  pluginMeta?: TanStackAuthPluginMeta;
  meta?: TanStackAuthMeta;
}): TanStackAuthPluginMeta | undefined {
  return options.meta?.plugin ?? options.pluginMeta;
}

function resolveClientCoreMeta(options: {
  coreMeta?: TanStackAuthCoreMeta;
  meta?: TanStackAuthMeta;
}): TanStackAuthCoreMeta {
  return options.meta?.core ?? options.coreMeta ?? NEXT_DEFAULT_GENERATED_CORE_META;
}

function toClientErrorMessage(
  response: Response,
  payload: unknown,
  fallback: string
): string {
  if (
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    typeof (payload as NextAuthErrorPayload).error === "string"
  ) {
    return (payload as NextAuthErrorPayload).error as string;
  }
  return `${fallback} (${response.status})`;
}

function asNextClientMutableCallable(
  value: unknown
): NextClientMutableCallable | null {
  if (typeof value !== "function") {
    return null;
  }
  return value as NextClientMutableCallable;
}

function hasNamedFunctionRef(value: unknown): value is { name: string } {
  if (!value || typeof value !== "object" || !("name" in value)) {
    return false;
  }
  return typeof (value as { name?: unknown }).name === "string";
}

function toClientQueryKeyFunctionRef<
  TFunctionRef extends FunctionReference<"query" | "action", "public">,
>(functionRef: TFunctionRef): string | TFunctionRef {
  try {
    return getFunctionName(functionRef);
  } catch {
    if (hasNamedFunctionRef(functionRef) && functionRef.name.length > 0) {
      return functionRef.name;
    }
    return functionRef;
  }
}

function withDefaultRouteInput<TFunctionRef extends NextClientRouteFunctionRef>(
  input: FunctionArgs<TFunctionRef> | undefined
): FunctionArgs<TFunctionRef> {
  if (input !== undefined) {
    return input;
  }
  return {} as FunctionArgs<TFunctionRef>;
}

function isNextClientMutationExecutor(
  value: unknown
): value is NextClientMutationExecutorLike {
  return (
    value !== null &&
    typeof value === "object" &&
    "mutation" in value &&
    typeof (value as { mutation?: unknown }).mutation === "function"
  );
}

function isNextClientActionExecutor(
  value: unknown
): value is NextClientActionExecutorLike {
  return (
    value !== null &&
    typeof value === "object" &&
    "action" in value &&
    typeof (value as { action?: unknown }).action === "function"
  );
}

function resolveNextClientMutationExecutor(
  executor: NextClientMutationExecutorLike | undefined
): NextClientMutationExecutorLike {
  if (!executor) {
    throw new Error(
      "No Convex mutation executor connected. Call authClient.connectConvexAuth(convex) before using mutationFn() or mutate() without an executor."
    );
  }
  return executor;
}

function resolveNextClientActionExecutor(
  executor: NextClientActionExecutorLike | undefined
): NextClientActionExecutorLike {
  if (!executor) {
    throw new Error(
      "No Convex action executor connected. Call authClient.connectConvexAuth(convex) before using actionFn() or runAction() without an executor."
    );
  }
  return executor;
}

function createNextClientQueryOptions<
  TFunctionRef extends FunctionReference<"query", "public">,
>(
  functionRef: TFunctionRef,
  input?: FunctionArgs<TFunctionRef>,
  queryExecutor?: (
    input: FunctionArgs<TFunctionRef>
  ) => Promise<FunctionReturnType<TFunctionRef>>
): NextClientQueryOptions<TFunctionRef> {
  const args = withDefaultRouteInput(input);
  const options: NextClientQueryOptions<TFunctionRef> = {
    queryKey: [NEXT_QUERY_KEY_PREFIX, toClientQueryKeyFunctionRef(functionRef), args],
    staleTime: Infinity,
  };
  if (queryExecutor) {
    options.queryFn = () => queryExecutor(args);
  }
  return options;
}

function createNextClientActionOptions<
  TFunctionRef extends FunctionReference<"action", "public">,
>(
  functionRef: TFunctionRef,
  input?: FunctionArgs<TFunctionRef>
): NextClientActionOptions<TFunctionRef> {
  return {
    queryKey: ["convexAction", toClientQueryKeyFunctionRef(functionRef), withDefaultRouteInput(input)],
    staleTime: Infinity,
  };
}

function attachNextClientQueryHelpers<
  TFunctionRef extends FunctionReference<"query", "public">,
>(
  routeMethod: NextClientMutableCallable,
  functionRef: TFunctionRef,
  queryExecutor?: (
    input: FunctionArgs<TFunctionRef>
  ) => Promise<FunctionReturnType<TFunctionRef>>
): void {
  const queryOptions = (input?: FunctionArgs<TFunctionRef>) =>
    createNextClientQueryOptions(functionRef, input, queryExecutor);
  routeMethod.query = queryOptions;
  routeMethod.queryOptions = queryOptions;
  routeMethod.suspenseQuery = queryOptions;
  routeMethod.prefetchQuery = async (
    queryClient: NextClientQueryClientLike,
    input?: FunctionArgs<TFunctionRef>
  ) => {
    await queryClient.prefetchQuery(queryOptions(input));
  };
  routeMethod.ensureQueryData = async (
    queryClient: NextClientQueryClientLike,
    input?: FunctionArgs<TFunctionRef>
  ) => {
    return queryClient.ensureQueryData<FunctionReturnType<TFunctionRef>>(
      queryOptions(input)
    );
  };
}

function attachNextClientMutationHelpers<
  TFunctionRef extends FunctionReference<"mutation", "public">,
>(
  routeMethod: NextClientMutableCallable,
  functionRef: TFunctionRef,
  getDefaultExecutor: () => NextClientMutationExecutorLike | undefined
): void {
  const mutate = async (
    inputOrConvex?: FunctionArgs<TFunctionRef> | NextClientMutationExecutorLike,
    maybeInput?: FunctionArgs<TFunctionRef>
  ): Promise<FunctionReturnType<TFunctionRef>> => {
    const convex = isNextClientMutationExecutor(inputOrConvex)
      ? inputOrConvex
      : getDefaultExecutor();
    const input = isNextClientMutationExecutor(inputOrConvex)
      ? maybeInput
      : inputOrConvex;
    return resolveNextClientMutationExecutor(convex).mutation(
      functionRef,
      withDefaultRouteInput(input)
    );
  };
  routeMethod.mutationFn = (convex?: NextClientMutationExecutorLike) => {
    const executor = resolveNextClientMutationExecutor(
      convex ?? getDefaultExecutor()
    );
    return async (input?: FunctionArgs<TFunctionRef>) => {
      return executor.mutation(functionRef, withDefaultRouteInput(input));
    };
  };
  routeMethod.mutate = mutate;
}

function attachNextClientActionHelpers<
  TFunctionRef extends FunctionReference<"action", "public">,
>(
  routeMethod: NextClientMutableCallable,
  functionRef: TFunctionRef,
  getDefaultExecutor: () => NextClientActionExecutorLike | undefined
): void {
  const queryOptions = (input?: FunctionArgs<TFunctionRef>) =>
    createNextClientActionOptions(functionRef, input);
  routeMethod.query = queryOptions;
  routeMethod.queryOptions = queryOptions;
  routeMethod.suspenseQuery = queryOptions;
  routeMethod.prefetchQuery = async (
    queryClient: NextClientQueryClientLike,
    input?: FunctionArgs<TFunctionRef>
  ) => {
    await queryClient.prefetchQuery(queryOptions(input));
  };
  routeMethod.ensureQueryData = async (
    queryClient: NextClientQueryClientLike,
    input?: FunctionArgs<TFunctionRef>
  ) => {
    return queryClient.ensureQueryData<FunctionReturnType<TFunctionRef>>(
      queryOptions(input)
    );
  };
  const runAction = async (
    inputOrConvex?: FunctionArgs<TFunctionRef> | NextClientActionExecutorLike,
    maybeInput?: FunctionArgs<TFunctionRef>
  ): Promise<FunctionReturnType<TFunctionRef>> => {
    const convex = isNextClientActionExecutor(inputOrConvex)
      ? inputOrConvex
      : getDefaultExecutor();
    const input = isNextClientActionExecutor(inputOrConvex)
      ? maybeInput
      : inputOrConvex;
    return resolveNextClientActionExecutor(convex).action(
      functionRef,
      withDefaultRouteInput(input)
    );
  };
  routeMethod.actionFn = (convex?: NextClientActionExecutorLike) => {
    const executor = resolveNextClientActionExecutor(
      convex ?? getDefaultExecutor()
    );
    return async (input?: FunctionArgs<TFunctionRef>) => {
      return executor.action(functionRef, withDefaultRouteInput(input));
    };
  };
  routeMethod.runAction = runAction;
}

function hasPluginFunctionRefs(convexFunctions: Record<string, unknown>): boolean {
  const pluginFunctions = readMember(convexFunctions, "plugin");
  if (
    !pluginFunctions ||
    (typeof pluginFunctions !== "object" && typeof pluginFunctions !== "function")
  ) {
    return false;
  }

  for (const pluginFunctionsValue of Object.values(
    pluginFunctions as Record<string, unknown>
  )) {
    if (
      !pluginFunctionsValue ||
      (typeof pluginFunctionsValue !== "object" &&
        typeof pluginFunctionsValue !== "function")
    ) {
      continue;
    }
    for (const functionRef of Object.values(
      pluginFunctionsValue as Record<string, unknown>
    )) {
      if (hasFunctionRefCandidate(functionRef)) {
        return true;
      }
    }
  }
  return false;
}

interface NextClientRouteRequester {
  basePath: string;
  credentials: RequestCredentials;
  requestJson: <T>(
    path: string,
    init: RequestInit,
    failure: NextClientRequestFailureContext
  ) => Promise<T>;
  requestVoid: (
    path: string,
    init: RequestInit,
    failure: NextClientRequestFailureContext
  ) => Promise<void>;
}

function createNextClientRouteRequester(
  options: NextAuthClientOptions
): NextClientRouteRequester {
  const basePath = normalizeClientBasePath(options.basePath ?? "/api/auth");
  const credentials = options.credentials ?? "same-origin";
  const fetchImpl = options.fetch ?? fetch;

  const resolveRequestUrl = async (path: string): Promise<string> => {
    if (options.resolveRequestUrl) {
      return await options.resolveRequestUrl(path, { basePath });
    }
    return `${basePath}/${path}`;
  };

  const request = async (
    path: string,
    init: RequestInit,
    failure: NextClientRequestFailureContext
  ): Promise<Response> => {
    const requestUrl = await resolveRequestUrl(path);
    const response = await fetchImpl(requestUrl, {
      ...init,
      credentials,
    });
    if (!response.ok) {
      const payload = await readClientJson(response);
      throw new Error(toClientErrorMessage(response, payload, failure.fallback));
    }
    return response;
  };

  const requestJson = async <T>(
    path: string,
    init: RequestInit,
    failure: NextClientRequestFailureContext
  ): Promise<T> => {
    const response = await request(path, init, failure);
    return (await readClientJson(response)) as T;
  };

  const requestVoid = async (
    path: string,
    init: RequestInit,
    failure: NextClientRequestFailureContext
  ): Promise<void> => {
    await request(path, init, failure);
  };

  return {
    basePath,
    credentials,
    requestJson,
    requestVoid,
  };
}

function createNextClientRouteMethod<
  TFunctionRef extends NextClientRouteFunctionRef,
>(options: {
  requester: NextClientRouteRequester;
  routePath: string;
  kind?: TanStackAuthPluginFunctionKind;
  functionRef: TFunctionRef;
  fallback: string;
  getDefaultMutationExecutor?: () => NextClientMutationExecutorLike | undefined;
  getDefaultActionExecutor?: () => NextClientActionExecutorLike | undefined;
}): (
  (input?: FunctionArgs<TFunctionRef>) => Promise<FunctionReturnType<TFunctionRef>>
) &
  Record<string, unknown> {
  const routeMethod = (async (input?: FunctionArgs<TFunctionRef>) => {
    const requestBody = input === undefined ? {} : input;
    return options.requester.requestJson<FunctionReturnType<TFunctionRef>>(
      options.routePath,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(requestBody),
      },
      {
        fallback: options.fallback,
      }
    );
  }) as (
    (input?: FunctionArgs<TFunctionRef>) => Promise<FunctionReturnType<TFunctionRef>>
  ) &
    Record<string, unknown>;

  const mutableRouteMethod = asNextClientMutableCallable(routeMethod);
  if (!mutableRouteMethod) {
    return routeMethod;
  }

  if (options.kind === "query") {
    attachNextClientQueryHelpers(
      mutableRouteMethod,
      options.functionRef as FunctionReference<"query", "public">,
      async (input) => {
        return routeMethod(
          input as unknown as FunctionArgs<TFunctionRef>
        ) as Promise<
          FunctionReturnType<FunctionReference<"query", "public">>
        >;
      }
    );
  } else if (options.kind === "mutation") {
    attachNextClientMutationHelpers(
      mutableRouteMethod,
      options.functionRef as FunctionReference<"mutation", "public">,
      options.getDefaultMutationExecutor ?? (() => undefined)
    );
  } else if (options.kind === "action") {
    attachNextClientActionHelpers(
      mutableRouteMethod,
      options.functionRef as FunctionReference<"action", "public">,
      options.getDefaultActionExecutor ?? (() => undefined)
    );
  }

  return routeMethod;
}

function createNextQueryAuthClient<
  TPlugins extends readonly TanStackStartAuthApiClientPlugin<object>[] = [],
  TConvexFunctions extends Record<string, unknown> = Record<string, unknown>,
  TPluginMeta extends TanStackAuthPluginMeta = TanStackAuthPluginMeta,
  TCoreMeta extends TanStackAuthCoreMeta = TanStackAuthCoreMeta,
>(
  options: NextQueryAuthClientOptions<
    TPlugins,
    TConvexFunctions,
    TPluginMeta,
    TCoreMeta
  >
): NextQueryAuthClient<TPlugins, TConvexFunctions, TPluginMeta, TCoreMeta> {
  const autoPluginsEnabled =
    options.plugins === undefined || options.plugins === "auto";
  const pluginMeta = resolveClientPluginMeta(options);

  if (
    autoPluginsEnabled &&
    hasPluginFunctionRefs(options.convexFunctions as Record<string, unknown>) &&
    pluginMeta === undefined
  ) {
    throw new Error(
      'createNextAuthClient requires "pluginMeta" when plugins is "auto" and convexFunctions is provided. ' +
        "Pass generated authMeta/authPluginMeta (convex/auth/metaGenerated.ts) " +
        'or disable auto plugins with plugins: [].'
    );
  }

  const requester = createNextClientRouteRequester(options as NextAuthClientOptions);
  const baseClient = createRouteAuthRuntimeAdapter({
    ...(options as NextAuthClientOptions),
    basePath: requester.basePath,
  });
  let defaultMutationExecutor: NextClientMutationExecutorLike | undefined;
  let defaultActionExecutor: NextClientActionExecutorLike | undefined;
  const originalConnectConvexAuth = baseClient.connectConvexAuth.bind(baseClient);
  baseClient.connectConvexAuth = (convexClient) => {
    defaultMutationExecutor = isNextClientMutationExecutor(convexClient)
      ? convexClient
      : undefined;
    defaultActionExecutor = isNextClientActionExecutor(convexClient)
      ? convexClient
      : undefined;
    return originalConnectConvexAuth(convexClient);
  };
  const plugins = (
    autoPluginsEnabled ? [] : options.plugins
  ) as readonly TanStackStartAuthApiClientPlugin<object>[];

  const inferredPluginMethods: Record<string, unknown> = {};
  if (autoPluginsEnabled && pluginMeta) {
    const pluginFunctions = readMember(options.convexFunctions, "plugin");
    const pluginExtension: Record<string, unknown> = {};

    for (const [pluginName, functions] of Object.entries(pluginMeta)) {
      const pluginFunctionRefs = readMember(pluginFunctions, pluginName);
      const clientFunctions: Record<string, unknown> = {};

      for (const [functionName, functionKind] of Object.entries(functions)) {
        const functionRef = readFunctionRef<ConvexRouteFunctionRef>(
          readMember(pluginFunctionRefs, functionName)
        );
        if (!functionRef) {
          throw new Error(
            `createNextAuthClient could not resolve "convexFunctions.plugin.${pluginName}.${functionName}".`
          );
        }

        const routePath = `plugin/${toKebabCase(pluginName)}/${toKebabCase(functionName)}`;
        clientFunctions[functionName] = createNextClientRouteMethod({
          requester,
          routePath,
          kind: functionKind,
          functionRef,
          fallback: `Could not call plugin method ${pluginName}.${functionName}`,
          getDefaultMutationExecutor: () => defaultMutationExecutor,
          getDefaultActionExecutor: () => defaultActionExecutor,
        });
      }

      if (Object.keys(clientFunctions).length > 0) {
        pluginExtension[pluginName] = clientFunctions;
      }
    }

    if (Object.keys(pluginExtension).length > 0) {
      inferredPluginMethods.plugin = pluginExtension;
    }
  }

  const inferredCoreMethods: Record<string, unknown> = {};
  const coreFunctions = readMember(options.convexFunctions, "core");
  const coreMetaFromOptions = options.meta?.core ?? options.coreMeta;
  if (
    coreFunctions &&
    (typeof coreFunctions === "object" || typeof coreFunctions === "function")
  ) {
    const coreFunctionNames =
      coreMetaFromOptions !== undefined
        ? Object.keys(coreMetaFromOptions)
        : Object.keys(coreFunctions as Record<string, unknown>);

    const coreExtension: Record<string, unknown> = {};
    for (const functionName of coreFunctionNames) {
      const functionRef = readFunctionRef<ConvexRouteFunctionRef>(
        readMember(coreFunctions, functionName)
      );
      if (!functionRef) {
        if (coreMetaFromOptions !== undefined) {
          throw new Error(
            `createNextAuthClient could not resolve "convexFunctions.core.${functionName}".`
          );
        }
        continue;
      }
      const functionKind = coreMetaFromOptions?.[functionName];
      coreExtension[functionName] = createNextClientRouteMethod({
        requester,
        routePath: `core/${toKebabCase(functionName)}`,
        ...(functionKind !== undefined ? { kind: functionKind } : {}),
        functionRef,
        fallback: `Could not call core method ${functionName}`,
        getDefaultMutationExecutor: () => defaultMutationExecutor,
        getDefaultActionExecutor: () => defaultActionExecutor,
      });
    }

    if (Object.keys(coreExtension).length > 0) {
      inferredCoreMethods.core = coreExtension;
    }
  }

  const pluginContext: TanStackStartAuthApiClientPluginContext = {
    basePath: requester.basePath,
    credentials: requester.credentials,
    requestJson: requester.requestJson,
    requestVoid: requester.requestVoid,
  };
  const pluginExtensions: Record<string, unknown> = {};
  for (const plugin of plugins) {
    Object.assign(pluginExtensions, plugin.create(pluginContext));
  }

  const client: Record<string, unknown> = {
    ...baseClient,
    ...inferredPluginMethods,
    ...inferredCoreMethods,
    ...pluginExtensions,
  };

  const coreMethods = readMember(client, "core");
  const coreFunctionRefs = readMember(options.convexFunctions, "core");
  const coreHelperMeta = resolveClientCoreMeta(options);
  if (
    coreMethods &&
    (typeof coreMethods === "object" || typeof coreMethods === "function")
  ) {
    for (const [functionName, functionKind] of Object.entries(coreHelperMeta)) {
      const routeMethod = asNextClientMutableCallable(
        readMember(coreMethods, functionName)
      );
      if (!routeMethod) {
        continue;
      }
      const functionRef = readFunctionRef<ConvexRouteFunctionRef>(
        readMember(coreFunctionRefs, functionName)
      );
      if (!functionRef) {
        continue;
      }

      if (functionKind === "query") {
        attachNextClientQueryHelpers(
          routeMethod,
          functionRef as FunctionReference<"query", "public">,
          async (input) => {
            return routeMethod(input) as Promise<
              FunctionReturnType<FunctionReference<"query", "public">>
            >;
          }
        );
      } else if (functionKind === "mutation") {
        attachNextClientMutationHelpers(
          routeMethod,
          functionRef as FunctionReference<"mutation", "public">,
          () => defaultMutationExecutor
        );
      } else if (functionKind === "action") {
        attachNextClientActionHelpers(
          routeMethod,
          functionRef as FunctionReference<"action", "public">,
          () => defaultActionExecutor
        );
      }
    }

    for (const [functionName, functionMethod] of Object.entries(
      coreMethods as Record<string, unknown>
    )) {
      const isReserved = NEXT_RESERVED_CORE_ROOT_METHOD_NAMES.has(functionName);
      const alreadyExists = functionName in client;
      if (isReserved || alreadyExists) {
        const reason = isReserved
          ? "is a reserved authClient key"
          : "already exists on authClient";
        throw new Error(
          `createNextAuthClient could not alias "core.${functionName}" at authClient root because "${functionName}" ${reason}. ` +
            "Rename the core function to avoid conflicts."
        );
      }
      client[functionName] = functionMethod;
    }
  }

  return client as NextQueryAuthClient<
    TPlugins,
    TConvexFunctions,
    TPluginMeta,
    TCoreMeta
  >;
}

/**
 * Next.js client adapter (route-backed) built on the shared runtime adapter.
 */
export function createNextAuthClient<
  TPlugins extends readonly TanStackStartAuthApiClientPlugin<object>[] = [],
  TConvexFunctions extends Record<string, unknown> = Record<string, unknown>,
  TPluginMeta extends TanStackAuthPluginMeta = TanStackAuthPluginMeta,
  TCoreMeta extends TanStackAuthCoreMeta = TanStackAuthCoreMeta,
>(
  options: NextQueryAuthClientOptions<
    TPlugins,
    TConvexFunctions,
    TPluginMeta,
    TCoreMeta
  >
): NextQueryAuthClient<TPlugins, TConvexFunctions, TPluginMeta, TCoreMeta>;
export function createNextAuthClient(
  options?: NextAuthClientOptions
): RouteAuthRuntimeAdapterClient;
export function createNextAuthClient<
  TPlugins extends readonly TanStackStartAuthApiClientPlugin<object>[] = [],
  TConvexFunctions extends Record<string, unknown> = Record<string, unknown>,
  TPluginMeta extends TanStackAuthPluginMeta = TanStackAuthPluginMeta,
  TCoreMeta extends TanStackAuthCoreMeta = TanStackAuthCoreMeta,
>(
  options:
    | NextAuthClientOptions
    | NextQueryAuthClientOptions<
        TPlugins,
        TConvexFunctions,
        TPluginMeta,
        TCoreMeta
      > = {}
):
  | RouteAuthRuntimeAdapterClient
  | NextQueryAuthClient<TPlugins, TConvexFunctions, TPluginMeta, TCoreMeta> {
  if (
    "convexFunctions" in options &&
    options.convexFunctions !== undefined
  ) {
    // Keep Next's "query client" branch local to avoid importing TanStack's
    // server URL resolver path in Next bundles. The only intended divergence is
    // framework-specific request URL resolution; route/plugin/core behavior stays aligned.
    const queryOptions = options as NextQueryAuthClientOptions<
      TPlugins,
      TConvexFunctions,
      TPluginMeta,
      TCoreMeta
    >;
    return createNextQueryAuthClient(queryOptions);
  }

  return createRouteAuthRuntimeAdapter({
    ...options,
    basePath: options.basePath ?? "/api/auth",
  });
}

/**
 * Build a ConvexZen React auth client from Next.js server helpers.
 */
export function createNextReactAuthClient(
  serverFns: NextAuthServerFns
): ReactAuthClient {
  return {
    getSession: async () => {
      return await serverFns.getSession();
    },
  };
}

/**
 * Create Next.js server-side auth helpers for cookie-backed session management.
 */
export function createNextServerAuth(options: NextServerAuthOptions): NextServerAuth {
  const cookieName = options.cookieName ?? "cz_session";
  const cookieOptions = resolveCookieOptions(options.cookieOptions);
  const clearCookieOptions: NextCookieOptions = {
    path: cookieOptions.path ?? "/",
    ...(cookieOptions.domain !== undefined
      ? { domain: cookieOptions.domain }
      : {}),
    ...(cookieOptions.httpOnly !== undefined
      ? { httpOnly: cookieOptions.httpOnly }
      : {}),
    ...(cookieOptions.secure !== undefined
      ? { secure: cookieOptions.secure }
      : {}),
    ...(cookieOptions.sameSite !== undefined
      ? { sameSite: cookieOptions.sameSite }
      : {}),
    maxAge: 0,
  };
  const sessionTokenCodec = options.sessionTokenCodec;
  const unauthorizedError = () => new Error("Unauthorized");

  const resolveAuthenticatedSession = async (
    request: Request
  ): Promise<AuthenticatedSession | null> => {
    const token = readCookie(request, cookieName);
    if (!token) {
      return null;
    }

    let sessionToken = token;
    let expectedUserId: string | null = null;
    if (sessionTokenCodec) {
      const decoded = await sessionTokenCodec.decode(token);
      if (!decoded) {
        return null;
      }
      sessionToken = decoded.sessionToken;
      expectedUserId = decoded.userId;
    }

    const session = await options.primitives.getSessionFromToken(sessionToken);
    if (!session) {
      return null;
    }
    if (expectedUserId !== null && session.userId !== expectedUserId) {
      return null;
    }

    return { token, session };
  };

  const getSession = async (request: Request) => {
    return (await resolveAuthenticatedSession(request))?.session ?? null;
  };

  const getToken = async (request: Request) => {
    return (await resolveAuthenticatedSession(request))?.token ?? null;
  };

  const signIn = async (input: SignInInput): Promise<NextSignInResult> => {
    const established = await options.primitives.signInAndResolveSession(input);
    const cookieToken = sessionTokenCodec
      ? await sessionTokenCodec.encode({
          userId: established.session.userId,
          sessionToken: established.sessionToken,
        })
      : established.sessionToken;

    return {
      session: established.session,
      token: cookieToken,
      setCookie: serializeCookie(cookieName, cookieToken, cookieOptions),
    };
  };

  const establishSession = async (
    sessionToken: string
  ): Promise<NextSignInResult> => {
    const session = await options.primitives.getSessionFromToken(sessionToken);
    if (!session) {
      throw new Error("Invalid session token");
    }

    const cookieToken = sessionTokenCodec
      ? await sessionTokenCodec.encode({
          userId: session.userId,
          sessionToken,
        })
      : sessionToken;

    return {
      session,
      token: cookieToken,
      setCookie: serializeCookie(cookieName, cookieToken, cookieOptions),
    };
  };

  const signOut = async (request: Request): Promise<NextSignOutResult> => {
    const token = readCookie(request, cookieName);
    let sessionToken = token;
    if (token && sessionTokenCodec) {
      const decoded = await sessionTokenCodec.decode(token);
      sessionToken = decoded?.sessionToken ?? null;
    }
    try {
      await options.primitives.signOutByToken(sessionToken);
    } finally {
      return {
        clearCookie: serializeCookie(cookieName, "", clearCookieOptions),
      };
    }
  };

  const requireSession = async (request: Request): Promise<AuthenticatedSession> => {
    const authenticated = await resolveAuthenticatedSession(request);
    if (!authenticated) {
      throw unauthorizedError();
    }
    return authenticated;
  };

  const withSession = async <T>(
    request: Request,
    handler: (auth: AuthenticatedSession) => Promise<T>
  ): Promise<T> => {
    return handler(await requireSession(request));
  };

  return {
    getSession,
    getToken,
    signIn,
    establishSession,
    signOut,
    requireSession,
    withSession,
  };
}

/**
 * Build a Request handler for Next.js `app/api/auth/[...auth]/route.ts` routes.
 */
export function createNextAuthApiHandler(
  options: NextAuthApiHandlerOptions
): (request: Request) => Promise<Response> {
  const basePath = normalizeBasePath(options.basePath ?? "/api/auth");
  const plugins = options.plugins ?? [];
  const oauthActions = resolveOAuthActionRefs(options.convexFunctions);
  const fetchMutation = options.fetchers?.fetchMutation;
  const fetchAction = options.fetchers?.fetchAction;

  return async (request: Request): Promise<Response> => {
    const requestUrl = new URL(request.url);
    const action = resolveActionFromPath(requestUrl.pathname, basePath);
    if (!action) {
      return json({ error: "Not found" }, 404);
    }

    let parsedBody: Promise<unknown> | null = null;
    const readRequestBody = async (): Promise<unknown> => {
      if (!parsedBody) {
        parsedBody = request.json().catch(() => null);
      }
      return parsedBody;
    };

    try {
      const actionSegments = action.split("/");
      const oauthAction = actionSegments[0];
      const providerSegment = actionSegments[1];
      if (
        request.method === "GET" &&
        actionSegments.length === 2 &&
        providerSegment &&
        isOAuthProviderId(providerSegment) &&
        (oauthAction === "sign-in" || oauthAction === "callback")
      ) {
        if (!fetchMutation || !fetchAction || !oauthActions) {
          if (oauthAction === "callback") {
            const stateCookie = parseOAuthStateCookie(request);
            return createOAuthErrorRedirectResponse({
              request,
              providerId: providerSegment,
              error: "oauth_callback_error",
              target: stateCookie?.errorRedirectTo ?? stateCookie?.redirectTo,
              clearStateCookie: true,
              basePath,
            });
          }
          return json({ error: "OAuth routes are not configured" }, 404);
        }

        if (oauthAction === "sign-in") {
          const redirectTo = requestUrl.searchParams.get("redirectTo") ?? "/";
          const errorRedirectTo =
            requestUrl.searchParams.get("errorRedirectTo") ?? redirectTo;
          if (
            !isSafeRedirectTarget(redirectTo) ||
            !isSafeRedirectTarget(errorRedirectTo)
          ) {
            return json(
              {
                error: "OAuth redirect targets must be relative paths",
              },
              400
            );
          }
          const callbackUrl = buildNextOAuthCallbackUrl(
            request,
            basePath,
            providerSegment
          );
          const startResult = await fetchMutation(oauthActions.getOAuthUrl, {
            providerId: providerSegment,
            callbackUrl,
            redirectTo,
            errorRedirectTo,
          });
          if (
            !isRecord(startResult) ||
            typeof startResult.authorizationUrl !== "string"
          ) {
            throw new Error("Invalid OAuth start response");
          }

          const state = parseAuthorizationUrlState(startResult.authorizationUrl);
          if (!state) {
            throw new Error("OAuth authorization URL is missing state");
          }

          const stateCookie = serializeOAuthStateCookie(basePath, {
            state,
            providerId: providerSegment,
            redirectTo,
            errorRedirectTo,
          });

          if (requestUrl.searchParams.get("mode") === "json") {
            return jsonNoStore(
              { authorizationUrl: startResult.authorizationUrl },
              200,
              { "set-cookie": stateCookie }
            );
          }

          return createRedirectResponse(
            request,
            startResult.authorizationUrl,
            [stateCookie]
          );
        }

        const stateCookie = parseOAuthStateCookie(request);
        const errorRedirectTarget =
          stateCookie?.errorRedirectTo ?? stateCookie?.redirectTo;
        const providerError = requestUrl.searchParams.get("error");
        if (providerError) {
          return createOAuthErrorRedirectResponse({
            request,
            providerId: providerSegment,
            error:
              providerError === "access_denied"
                ? "oauth_access_denied"
                : "oauth_callback_error",
            description:
              requestUrl.searchParams.get("error_description") ?? providerError,
            target: errorRedirectTarget,
            clearStateCookie: true,
            basePath,
          });
        }

        const state = requestUrl.searchParams.get("state");
        if (
          !stateCookie ||
          stateCookie.providerId !== providerSegment ||
          typeof state !== "string" ||
          state !== stateCookie.state
        ) {
          return createOAuthErrorRedirectResponse({
            request,
            providerId: providerSegment,
            error: "oauth_invalid_state",
            target: errorRedirectTarget,
            clearStateCookie: true,
            basePath,
          });
        }

        const code = requestUrl.searchParams.get("code");
        if (!code) {
          return createOAuthErrorRedirectResponse({
            request,
            providerId: providerSegment,
            error: "oauth_callback_error",
            description: "Missing OAuth authorization code",
            target: errorRedirectTarget,
            clearStateCookie: true,
            basePath,
          });
        }

        try {
          const requestIp = resolveClientIp(request, options);
          const requestUserAgent = request.headers.get("user-agent") ?? undefined;
          const callbackResult = parseOAuthCallbackResult(
            await fetchAction(oauthActions.handleOAuthCallback, {
              providerId: providerSegment,
              code,
              state,
              callbackUrl: buildNextOAuthCallbackUrl(
                request,
                basePath,
                providerSegment
              ),
              ...(requestIp !== undefined ? { ipAddress: requestIp } : {}),
              ...(requestUserAgent !== undefined
                ? { userAgent: requestUserAgent }
                : {}),
            })
          );
          if (typeof callbackResult?.sessionToken !== "string") {
            throw new Error("Invalid OAuth callback response");
          }

          const established = await options.nextAuth.establishSession(
            callbackResult.sessionToken
          );
          const redirectTarget =
            (typeof callbackResult.redirectTo === "string"
              ? callbackResult.redirectTo
              : null) ??
            (typeof callbackResult.redirectUrl === "string"
              ? callbackResult.redirectUrl
              : null) ??
            stateCookie.redirectTo;

          return createRedirectResponse(
            request,
            normalizeRedirectTarget(request, redirectTarget),
            [
              established.setCookie,
              clearOAuthStateCookie(basePath),
            ]
          );
        } catch (error) {
          return createOAuthErrorRedirectResponse({
            request,
            providerId: providerSegment,
            error: mapOAuthErrorCode(error),
            description: isProductionRuntime() ? undefined : toErrorMessage(error),
            target: errorRedirectTarget,
            clearStateCookie: true,
            basePath,
          });
        }
      }

      if (
        request.method !== "GET" &&
        !(await isAllowedOriginRequest(request, options.trustedOrigins))
      ) {
        return json({ error: "Forbidden origin" }, 403);
      }

      if (request.method === "GET" && action === "session") {
        const session = await options.nextAuth.getSession(request);
        return json({ session });
      }

      if (request.method === "GET" && action === "token") {
        const token = await options.nextAuth.getToken(request);
        const tokenPayload: {
          token: string | null;
          issuedAtMs?: number;
          expiresAtMs?: number;
        } = {
          token,
        };
        if (token) {
          const metadata = extractJwtTokenMetadata(token);
          if (metadata.issuedAtMs !== undefined) {
            tokenPayload.issuedAtMs = metadata.issuedAtMs;
          }
          if (metadata.expiresAtMs !== undefined) {
            tokenPayload.expiresAtMs = metadata.expiresAtMs;
          }
        }
        return jsonNoStore(tokenPayload);
      }

      if (request.method === "POST" && action === "sign-in-with-email") {
        const body = (await readRequestBody()) as {
          email?: unknown;
          password?: unknown;
          userAgent?: unknown;
        };

        if (
          typeof body?.email !== "string" ||
          typeof body?.password !== "string"
        ) {
          return json({ error: "Invalid request body" }, 400);
        }

        const signInInput: SignInInput = {
          email: body.email,
          password: body.password,
        };

        const requestIp = resolveClientIp(request, options);
        if (requestIp) {
          signInInput.ipAddress = requestIp;
        }

        if (typeof body.userAgent === "string" && body.userAgent.length > 0) {
          signInInput.userAgent = body.userAgent;
        } else {
          const headerUserAgent = request.headers.get("user-agent");
          if (headerUserAgent) {
            signInInput.userAgent = headerUserAgent;
          }
        }

        const result = await options.nextAuth.signIn(signInInput);
        return json(
          { session: result.session },
          200,
          {
            "set-cookie": result.setCookie,
          }
        );
      }

      if (request.method === "POST" && action === "sign-out") {
        const result = await options.nextAuth.signOut(request);
        return json(
          { ok: true },
          200,
          {
            "set-cookie": result.clearCookie,
          }
        );
      }

      const pluginContext: NextAuthApiPluginContext = {
        request,
        method: request.method,
        action,
        readJson: readRequestBody,
        json,
      };
      for (const plugin of plugins) {
        const response = await plugin.handle(pluginContext);
        if (response) {
          return response;
        }
      }

      return json({ error: "Not found" }, 404);
    } catch (error) {
      if (isProductionRuntime()) {
        return json({ error: "Authentication request failed" }, 400);
      }
      return json({ error: toErrorMessage(error) }, 400);
    }
  };
}

/**
 * Convenience helper: create Next server auth helpers and route handler together.
 * Use this when you already have session primitives and don't need Convex wiring.
 */
export function createNextServerAuthWithHandler(
  options: NextAuthServerOptions
): NextAuthServer {
  const nextAuth = createNextServerAuth(options);
  const handler = createNextAuthApiHandler({
    nextAuth,
    ...(options.basePath !== undefined ? { basePath: options.basePath } : {}),
    ...(options.trustedOrigins !== undefined
      ? { trustedOrigins: options.trustedOrigins }
      : {}),
    ...(options.trustedProxy !== undefined
      ? { trustedProxy: options.trustedProxy }
      : {}),
    ...(options.getClientIp !== undefined
      ? { getClientIp: options.getClientIp }
      : {}),
    ...(options.convexFunctions !== undefined
      ? { convexFunctions: options.convexFunctions }
      : {}),
    ...(options.coreMeta !== undefined ? { coreMeta: options.coreMeta } : {}),
    ...(options.fetchers !== undefined ? { fetchers: options.fetchers } : {}),
  });

  return {
    ...nextAuth,
    handler,
  };
}

/**
 * Build Convex fetch helpers for Next server functions and route handlers.
 * Authenticated helpers resolve auth from the passed Request via requireSession.
 */
export function createNextConvexFetchers(
  options: NextConvexFetchersOptions
): NextConvexFetchers {
  const sharedFetchers = createConvexFetchers<Request>({
    convexUrl: options.convexUrl,
    resolveAuthToken: async (request) => {
      return (await options.nextAuth.requireSession(request)).token;
    },
  });

  return {
    fetchQuery: sharedFetchers.fetchQuery,
    fetchMutation: sharedFetchers.fetchMutation,
    fetchAction: sharedFetchers.fetchAction,
    fetchAuthQuery: sharedFetchers.fetchAuthQuery,
    fetchAuthMutation: sharedFetchers.fetchAuthMutation,
    fetchAuthAction: sharedFetchers.fetchAuthAction,
  };
}

/**
 * Build a lazily initialized Convex-backed Next auth server from env config.
 *
 * This keeps application `auth-server.ts` files minimal while preserving
 * explicit, typed control over env vars and trusted origins.
 */
export function createNextAuthServerFactory(
  options: NextConvexAuthServerFactoryOptions
): NextConvexAuthServerFactory {
  const env = options.env ?? resolveProcessEnv();
  const convexUrlEnvVar = options.convexUrlEnvVar ?? "NEXT_PUBLIC_CONVEX_URL";
  const trustedOriginsFromEnv =
    options.trustedOriginsFromEnv === false
      ? false
      : {
          ...(options.trustedOriginsFromEnv ?? {}),
          env,
        };

  let cachedAuthServer: NextConvexAuthServer | null = null;
  let cachedInitError: Error | null = null;

  const init = (): {
    authServer: NextConvexAuthServer | null;
    initError: Error | null;
  } => {
    if (cachedAuthServer || cachedInitError) {
      return {
        authServer: cachedAuthServer,
        initError: cachedInitError,
      };
    }

    try {
      const convexUrl = env[convexUrlEnvVar];
      if (!convexUrl) {
        throw new Error(
          `Missing ${convexUrlEnvVar}. Configure it in your app environment.`
        );
      }

      cachedAuthServer = createNextAuthServer({
        convexUrl,
        convexFunctions: options.convexFunctions,
        ...(options.cookieName !== undefined
          ? { cookieName: options.cookieName }
          : {}),
        ...(options.cookieOptions !== undefined
          ? { cookieOptions: options.cookieOptions }
          : {}),
        ...(options.sessionTokenCodec !== undefined
          ? { sessionTokenCodec: options.sessionTokenCodec }
          : {}),
        ...(options.meta !== undefined ? { meta: options.meta } : {}),
        ...(options.coreMeta !== undefined ? { coreMeta: options.coreMeta } : {}),
        ...(options.pluginMeta !== undefined
          ? { pluginMeta: options.pluginMeta }
          : {}),
        ...(options.basePath !== undefined ? { basePath: options.basePath } : {}),
        ...(options.trustedOrigins !== undefined
          ? { trustedOrigins: options.trustedOrigins }
          : {}),
        ...(trustedOriginsFromEnv !== undefined
          ? { trustedOriginsFromEnv }
          : {}),
        ...(options.trustedProxy !== undefined
          ? { trustedProxy: options.trustedProxy }
          : {}),
        ...(options.getClientIp !== undefined
          ? { getClientIp: options.getClientIp }
          : {}),
      });
    } catch (error) {
      cachedInitError = asError(error);
    }

    return {
      authServer: cachedAuthServer,
      initError: cachedInitError,
    };
  };

  const handler = async (request: Request): Promise<Response> => {
    const { authServer, initError } = init();
    if (!authServer) {
      return json(
        {
          error: initError?.message ?? "Auth server is not configured",
        },
        500
      );
    }
    return authServer.handler(request);
  };

  const requireSession = async (
    request: Request
  ): Promise<AuthenticatedSession> => {
    const { authServer, initError } = init();
    if (!authServer) {
      throw initError ?? new Error("Auth server is not configured");
    }
    return authServer.requireSession(request);
  };

  const isAuthenticated = async (pathname = "/"): Promise<boolean> => {
    const { authServer, initError } = init();
    if (!authServer) {
      throw initError ?? new Error("Auth server is not configured");
    }
    return authServer.isAuthenticated(pathname);
  };

  const getSession = async (
    requestOrPath?: Request | string
  ): Promise<SessionInfo | null> => {
    const { authServer, initError } = init();
    if (!authServer) {
      throw initError ?? new Error("Auth server is not configured");
    }
    if (requestOrPath instanceof Request) {
      return authServer.getSession(requestOrPath);
    }
    return authServer.getSession(
      typeof requestOrPath === "string" ? requestOrPath : "/"
    );
  };

  const getToken = async (
    requestOrPath?: Request | string
  ): Promise<string | null> => {
    const { authServer, initError } = init();
    if (!authServer) {
      throw initError ?? new Error("Auth server is not configured");
    }
    if (requestOrPath instanceof Request) {
      return authServer.getToken(requestOrPath);
    }
    return authServer.getToken(
      typeof requestOrPath === "string" ? requestOrPath : "/"
    );
  };

  const fetchQuery = async <Query extends FunctionReference<"query", "public">>(
    fn: Query,
    args: FunctionArgs<Query>
  ): Promise<FunctionReturnType<Query>> => {
    const { authServer, initError } = init();
    if (!authServer) {
      throw initError ?? new Error("Auth server is not configured");
    }
    return authServer.fetchQuery(fn, args);
  };

  const fetchMutation = async <
    Mutation extends FunctionReference<"mutation", "public">,
  >(
    fn: Mutation,
    args: FunctionArgs<Mutation>
  ): Promise<FunctionReturnType<Mutation>> => {
    const { authServer, initError } = init();
    if (!authServer) {
      throw initError ?? new Error("Auth server is not configured");
    }
    return authServer.fetchMutation(fn, args);
  };

  const fetchAction = async <Action extends FunctionReference<"action", "public">>(
    fn: Action,
    args: FunctionArgs<Action>
  ): Promise<FunctionReturnType<Action>> => {
    const { authServer, initError } = init();
    if (!authServer) {
      throw initError ?? new Error("Auth server is not configured");
    }
    return authServer.fetchAction(fn, args);
  };

  const fetchAuthQuery = (async (...args: unknown[]) => {
    const { authServer, initError } = init();
    if (!authServer) {
      throw initError ?? new Error("Auth server is not configured");
    }
    return (authServer.fetchAuthQuery as (...input: unknown[]) => Promise<unknown>)(
      ...args
    );
  }) as NextServerAuthQueryFetcher;

  const fetchAuthMutation = (async (...args: unknown[]) => {
    const { authServer, initError } = init();
    if (!authServer) {
      throw initError ?? new Error("Auth server is not configured");
    }
    return (
      authServer.fetchAuthMutation as (...input: unknown[]) => Promise<unknown>
    )(...args);
  }) as NextServerAuthMutationFetcher;

  const fetchAuthAction = (async (...args: unknown[]) => {
    const { authServer, initError } = init();
    if (!authServer) {
      throw initError ?? new Error("Auth server is not configured");
    }
    return (authServer.fetchAuthAction as (...input: unknown[]) => Promise<unknown>)(
      ...args
    );
  }) as NextServerAuthActionFetcher;

  return {
    getAuthServer: () => init().authServer,
    getInitError: () => init().initError,
    handler,
    getSession: getSession as NextServerGetSession,
    getToken: getToken as NextServerGetToken,
    isAuthenticated,
    requireSession,
    fetchQuery,
    fetchMutation,
    fetchAction,
    fetchAuthQuery,
    fetchAuthMutation,
    fetchAuthAction,
  };
}

/**
 * Build Next.js server auth helpers directly from Convex action refs.
 */
export function createNextConvexAuth(
  options: NextConvexAuthOptions
): NextServerAuth {
  const coreActions = resolveCoreActions(options.convexFunctions);
  const convex = new ConvexHttpClient(options.convexUrl);
  const primitives = createSessionPrimitives({
    signIn: async (input) => {
      return (await convex.mutation(coreActions.signInWithEmail, input)) as SignInOutput;
    },
    validateSession: async (token) => {
      return (await convex.mutation(coreActions.validateSession, {
        token,
      })) as SessionInfo | null;
    },
    signOut: async (token) => {
      await convex.mutation(coreActions.invalidateSession, { token });
    },
  });

  const serverOptions: NextServerAuthOptions = {
    primitives,
    sessionTokenCodec:
      options.sessionTokenCodec ??
      createConvexZenIdentityJwt().sessionTokenCodec,
  };
  if (options.cookieName !== undefined) {
    serverOptions.cookieName = options.cookieName;
  }
  if (options.cookieOptions !== undefined) {
    serverOptions.cookieOptions = options.cookieOptions;
  }

  return createNextServerAuth(serverOptions);
}

/**
 * Build Next.js server auth helpers + `/api/auth/*` route handler from Convex refs.
 */
export function createNextAuthServer(
  options: NextConvexAuthServerOptions
): NextConvexAuthServer {
  const autoPluginsEnabled =
    options.plugins === undefined || options.plugins === "auto";
  const pluginMeta = resolvePluginMeta(options);
  if (
    autoPluginsEnabled &&
    hasPluginFunctionRefs(options.convexFunctions as Record<string, unknown>) &&
    pluginMeta === undefined
  ) {
    throw new Error(
      'createNextAuthServer requires "pluginMeta" when plugins is "auto". ' +
        "Pass generated authMeta/authPluginMeta (convex/auth/metaGenerated.ts) " +
        'or disable auto plugins with plugins: [].'
    );
  }

  const nextAuth = createNextConvexAuth(options);
  const trustedOriginsFromEnv =
    options.trustedOriginsFromEnv === false
      ? []
      : resolveNextTrustedOriginsFromEnv(options.trustedOriginsFromEnv ?? {});
  const mergedTrustedOrigins = mergeTrustedOrigins(
    options.trustedOrigins,
    trustedOriginsFromEnv
  );
  const getSession = createNextGetSession(nextAuth.getSession);
  const getToken = createNextGetToken(nextAuth.getToken);
  const isAuthenticated = createNextIsAuthenticated(nextAuth.requireSession);
  const fetchers = createNextConvexFetchers({
    nextAuth,
    convexUrl: options.convexUrl,
  });
  const fetchAuthQuery = createNextServerAuthFetcher<"query">(
    fetchers.fetchAuthQuery
  );
  const fetchAuthMutation = createNextServerAuthFetcher<"mutation">(
    fetchers.fetchAuthMutation
  );
  const fetchAuthAction = createNextServerAuthFetcher<"action">(
    fetchers.fetchAuthAction
  );
  const coreMeta = resolveCoreMeta(options);
  const autoPluginFactories: NextAuthApiPluginFactory[] = [];
  autoPluginFactories.push(
    coreApiPlugin(coreMeta !== undefined ? { coreMeta } : {})
  );
  if (hasPluginMeta(pluginMeta)) {
    autoPluginFactories.push(
      pluginApiPlugin({
        pluginMeta: pluginMeta as NextAuthPluginMeta,
      })
    );
  }
  const pluginFactories = (
    autoPluginsEnabled ? autoPluginFactories : options.plugins
  ) as readonly NextAuthApiPluginFactory[];
  const plugins = pluginFactories.map((plugin) =>
    plugin.create({
      nextAuth,
      fetchers,
      convexFunctions: options.convexFunctions as Record<string, unknown>,
    })
  );
  const handler = createNextAuthApiHandler({
    nextAuth,
    plugins,
    convexFunctions: options.convexFunctions as Record<string, unknown>,
    fetchers,
    ...(coreMeta !== undefined ? { coreMeta } : {}),
    ...(options.basePath !== undefined ? { basePath: options.basePath } : {}),
    ...(mergedTrustedOrigins !== undefined
      ? { trustedOrigins: mergedTrustedOrigins }
      : {}),
    ...(options.trustedProxy !== undefined
      ? { trustedProxy: options.trustedProxy }
      : {}),
    ...(options.getClientIp !== undefined
      ? { getClientIp: options.getClientIp }
      : {}),
  });

  return {
    ...nextAuth,
    getSession,
    fetchQuery: fetchers.fetchQuery,
    fetchMutation: fetchers.fetchMutation,
    fetchAction: fetchers.fetchAction,
    fetchAuthQuery,
    fetchAuthMutation,
    fetchAuthAction,
    handler,
    getToken,
    isAuthenticated,
  };
}
