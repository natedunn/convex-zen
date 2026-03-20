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
} from "../framework-adapter";
import type { ReactAuthClient } from "../react";
import type { SessionInfo } from "../primitives";
import {
  type AuthCoreMeta,
  type AuthMeta,
  type AuthPluginFunctionKind,
  type AuthPluginMeta,
  toKebabCase,
} from "../plugin-meta";
import {
  type TanStackQueryAuthClient,
  type TanStackQueryAuthClientOptions,
  type TanStackStartAuthApiClientPlugin,
  type TanStackStartAuthApiClientPluginContext,
} from "../tanstack-start/client";
import {
  type ConvexRouteFunctionRef,
  readMember,
  readFunctionRef,
  hasPluginFunctionRefs,
} from "../helpers";

export interface NextAuthClientOptions extends RouteAuthRuntimeAdapterOptions {}

export type NextQueryAuthClientOptions<
  TPlugins extends readonly TanStackStartAuthApiClientPlugin<object>[] = [],
  TConvexFunctions extends Record<string, unknown> = Record<string, unknown>,
  TPluginMeta extends AuthPluginMeta = AuthPluginMeta,
  TCoreMeta extends AuthCoreMeta = AuthCoreMeta,
> = TanStackQueryAuthClientOptions<
  TPlugins,
  TConvexFunctions,
  TPluginMeta,
  TCoreMeta
>;

export type NextQueryAuthClient<
  TPlugins extends readonly TanStackStartAuthApiClientPlugin<object>[] = [],
  TConvexFunctions extends Record<string, unknown> = Record<string, unknown>,
  TPluginMeta extends AuthPluginMeta = AuthPluginMeta,
  TCoreMeta extends AuthCoreMeta = AuthCoreMeta,
> = TanStackQueryAuthClient<
  TPlugins,
  TConvexFunctions,
  TPluginMeta,
  TCoreMeta
>;

interface NextAuthErrorPayload {
  error?: string;
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
} as const satisfies AuthCoreMeta;

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
  pluginMeta?: AuthPluginMeta;
  meta?: AuthMeta;
}): AuthPluginMeta | undefined {
  return options.meta?.plugin ?? options.pluginMeta;
}

function resolveClientCoreMeta(options: {
  coreMeta?: AuthCoreMeta;
  meta?: AuthMeta;
}): AuthCoreMeta {
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
  kind?: AuthPluginFunctionKind;
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
  TPluginMeta extends AuthPluginMeta = AuthPluginMeta,
  TCoreMeta extends AuthCoreMeta = AuthCoreMeta,
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
        "Pass generated authMeta/authPluginMeta (convex/auth/generated.ts) " +
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
  TPluginMeta extends AuthPluginMeta = AuthPluginMeta,
  TCoreMeta extends AuthCoreMeta = AuthCoreMeta,
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
  TPluginMeta extends AuthPluginMeta = AuthPluginMeta,
  TCoreMeta extends AuthCoreMeta = AuthCoreMeta,
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
  serverFns: { getSession: () => Promise<SessionInfo | null> }
): ReactAuthClient {
  return {
    getSession: async () => {
      return await serverFns.getSession();
    },
  };
}
