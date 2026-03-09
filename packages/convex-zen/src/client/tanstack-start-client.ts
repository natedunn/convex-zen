import type { SessionInfo, SignInInput } from "./primitives";
import type { ReactAuthClient } from "./react";
import type {
  OAuthProviderId,
  OAuthStartResult,
} from "../types";
import type {
  FunctionArgs,
  FunctionReference,
  FunctionReturnType,
} from "convex/server";
import { getFunctionName } from "convex/server";
import type {
  TanStackAuthCoreMeta,
  TanStackAuthMeta,
  TanStackAuthPluginMeta,
} from "./tanstack-start-plugin-meta";
import { toKebabCase } from "./tanstack-start-plugin-meta";
import type { AuthTokenPayload } from "./auth-token-manager";
import {
  createAuthRuntime,
  createBroadcastAuthSync,
  createLocalStorageAuthStorage,
  type AuthRuntimeStorage,
  type AuthRuntimeSync,
  type ConvexAuthClientLike,
} from "./auth-runtime";
export {
  createAuthTokenManager,
  type AuthTokenManager,
  type AuthTokenManagerGetTokenOptions,
  type AuthTokenManagerListener,
  type AuthTokenManagerOptions,
  type AuthTokenPayload,
} from "./auth-token-manager";
export {
  createAuthRuntime,
  createMemoryAuthStorage,
  createLocalStorageAuthStorage,
  createBroadcastAuthSync,
  type AuthStatus,
  type AuthRuntime,
  type AuthRuntimeEvent,
  type AuthRuntimeOptions,
  type AuthRuntimeState,
  type AuthRuntimeStorage,
  type AuthRuntimeSync,
  type AuthRuntimeTokenProvider,
  type AuthSyncSignal,
  type BroadcastAuthSyncOptions,
  type ConvexAuthClientLike,
  type LocalStorageAuthStorageOptions,
} from "./auth-runtime";

interface AuthApiErrorPayload {
  error?: string;
}

interface SessionResponsePayload {
  session?: SessionInfo | null;
}

interface TokenResponsePayload {
  token?: string | null;
  issuedAtMs?: number;
  expiresAtMs?: number;
}

type UnionToIntersection<T> = (
  T extends unknown ? (arg: T) => void : never
) extends (arg: infer I) => void
  ? I
  : never;

type Simplify<T> = { [K in keyof T]: T[K] } & {};

type PluginExtension<TPlugin> = TPlugin extends TanStackStartAuthApiClientPlugin<
  infer TExtension
>
  ? TExtension
  : never;

type PluginExtensions<
  TPlugins extends readonly TanStackStartAuthApiClientPlugin<object>[],
> = [TPlugins[number]] extends [never]
  ? {}
  : Simplify<UnionToIntersection<PluginExtension<TPlugins[number]>>>;

type PluginClientExtensionsFromConvexFunctions<TConvexFunctions> =
  TConvexFunctions extends { plugin: infer TPlugin }
    ? {
        plugin: {
          [TPluginName in keyof TPlugin & string]: TPlugin[TPluginName] extends Record<
            string,
            unknown
          >
            ? {
                [TFunctionName in keyof TPlugin[TPluginName] &
                  string as TPlugin[TPluginName][TFunctionName] extends FunctionReference<
                  "query" | "mutation" | "action",
                  "public"
                >
                  ? TFunctionName
                  : never]: TPlugin[TPluginName][TFunctionName] extends FunctionReference<
                  "query" | "mutation" | "action",
                  "public"
                >
                  ? (
                      input?: FunctionArgs<TPlugin[TPluginName][TFunctionName]>
                    ) => Promise<
                      FunctionReturnType<TPlugin[TPluginName][TFunctionName]>
                    >
                  : never;
              }
            : never;
        };
      }
    : {};

type CoreClientExtensionsFromConvexFunctions<TConvexFunctions> =
  TConvexFunctions extends { core: infer TCore }
    ? {
        core: {
          [TFunctionName in keyof TCore &
            string as TCore[TFunctionName] extends FunctionReference<
            "query" | "mutation" | "action",
            "public"
          >
            ? TFunctionName
            : never]: TCore[TFunctionName] extends FunctionReference<
            "query" | "mutation" | "action",
            "public"
          >
            ? (
                input?: FunctionArgs<TCore[TFunctionName]>
              ) => Promise<FunctionReturnType<TCore[TFunctionName]>>
            : never;
        };
      }
    : {};

type ReservedAuthClientRootName =
  | "getSession"
  | "getToken"
  | "clearToken"
  | "connectConvexAuth"
  | "signOut"
  | "signIn"
  | "plugin"
  | "core";

type CoreRootAliasExtensionsFromConvexFunctions<TConvexFunctions> =
  TConvexFunctions extends { core: infer TCore }
    ? {
        [TFunctionName in keyof TCore &
          string as TCore[TFunctionName] extends FunctionReference<
          "query" | "mutation" | "action",
          "public"
        >
          ? TFunctionName extends ReservedAuthClientRootName
            ? never
            : TFunctionName
          : never]: TCore[TFunctionName] extends FunctionReference<
          "query" | "mutation" | "action",
          "public"
        >
          ? (
              input?: FunctionArgs<TCore[TFunctionName]>
            ) => Promise<FunctionReturnType<TCore[TFunctionName]>>
          : never;
      }
    : {};

type ConvexPluginFunctionRef = FunctionReference<
  "query" | "mutation" | "action",
  "public"
>;

type RoutePluginMethod<TFunctionRef extends ConvexPluginFunctionRef> = (
  input?: FunctionArgs<TFunctionRef>
) => Promise<FunctionReturnType<TFunctionRef>>;

export interface ConvexQueryOptions<
  TFunctionRef extends FunctionReference<"query", "public">,
  TPrefix extends string = "convexQuery",
> {
  queryKey: [TPrefix, TFunctionRef, FunctionArgs<TFunctionRef>];
  queryFn?: (
    context: unknown
  ) => Promise<FunctionReturnType<TFunctionRef>> | FunctionReturnType<TFunctionRef>;
  staleTime: number;
}

export interface ConvexActionOptions<
  TFunctionRef extends FunctionReference<"action", "public">,
> {
  queryKey: ["convexAction", TFunctionRef, FunctionArgs<TFunctionRef>];
  queryFn?: (
    context: unknown
  ) => Promise<FunctionReturnType<TFunctionRef>> | FunctionReturnType<TFunctionRef>;
  enabled?: boolean;
  staleTime: number;
}

export interface TanStackQueryClientLike {
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

export interface ConvexMutationExecutorLike {
  mutation: <TFunctionRef extends FunctionReference<"mutation", "public">>(
    functionRef: TFunctionRef,
    args: FunctionArgs<TFunctionRef>
  ) => Promise<FunctionReturnType<TFunctionRef>>;
}

export interface ConvexActionExecutorLike {
  action: <TFunctionRef extends FunctionReference<"action", "public">>(
    functionRef: TFunctionRef,
    args: FunctionArgs<TFunctionRef>
  ) => Promise<FunctionReturnType<TFunctionRef>>;
}

type TanStackQueryRouteMethod<
  TFunctionRef extends FunctionReference<"query", "public">,
> = RoutePluginMethod<TFunctionRef> & {
  query: (
    input?: FunctionArgs<TFunctionRef>
  ) => ConvexQueryOptions<TFunctionRef, ConvexQueryKeyPrefix>;
  queryOptions: (
    input?: FunctionArgs<TFunctionRef>
  ) => ConvexQueryOptions<TFunctionRef, ConvexQueryKeyPrefix>;
  suspenseQuery: (
    input?: FunctionArgs<TFunctionRef>
  ) => ConvexQueryOptions<TFunctionRef, ConvexQueryKeyPrefix>;
  prefetchQuery: (
    queryClient: TanStackQueryClientLike,
    input?: FunctionArgs<TFunctionRef>
  ) => Promise<void>;
  ensureQueryData: (
    queryClient: TanStackQueryClientLike,
    input?: FunctionArgs<TFunctionRef>
  ) => Promise<FunctionReturnType<TFunctionRef>>;
};

type TanStackActionRouteMethod<
  TFunctionRef extends FunctionReference<"action", "public">,
> = RoutePluginMethod<TFunctionRef> & {
  query: (input?: FunctionArgs<TFunctionRef>) => ConvexActionOptions<TFunctionRef>;
  queryOptions: (
    input?: FunctionArgs<TFunctionRef>
  ) => ConvexActionOptions<TFunctionRef>;
  suspenseQuery: (
    input?: FunctionArgs<TFunctionRef>
  ) => ConvexActionOptions<TFunctionRef>;
  prefetchQuery: (
    queryClient: TanStackQueryClientLike,
    input?: FunctionArgs<TFunctionRef>
  ) => Promise<void>;
  ensureQueryData: (
    queryClient: TanStackQueryClientLike,
    input?: FunctionArgs<TFunctionRef>
  ) => Promise<FunctionReturnType<TFunctionRef>>;
  actionFn: (
    convex: ConvexActionExecutorLike
  ) => (input?: FunctionArgs<TFunctionRef>) => Promise<FunctionReturnType<TFunctionRef>>;
  runAction: (
    convex: ConvexActionExecutorLike,
    input?: FunctionArgs<TFunctionRef>
  ) => Promise<FunctionReturnType<TFunctionRef>>;
};

type TanStackMutationRouteMethod<
  TFunctionRef extends FunctionReference<"mutation", "public">,
> = RoutePluginMethod<TFunctionRef> & {
  mutationFn: (
    convex: ConvexMutationExecutorLike
  ) => (input?: FunctionArgs<TFunctionRef>) => Promise<FunctionReturnType<TFunctionRef>>;
  mutate: (
    convex: ConvexMutationExecutorLike,
    input?: FunctionArgs<TFunctionRef>
  ) => Promise<FunctionReturnType<TFunctionRef>>;
};

type TanStackMethodForKind<
  TFunctionRef extends ConvexPluginFunctionRef,
  TKind extends "query" | "mutation" | "action",
> = TKind extends "query"
  ? TFunctionRef extends FunctionReference<"query", "public">
    ? TanStackQueryRouteMethod<TFunctionRef>
    : never
  : TKind extends "mutation"
    ? TFunctionRef extends FunctionReference<"mutation", "public">
      ? TanStackMutationRouteMethod<TFunctionRef>
      : never
    : TFunctionRef extends FunctionReference<"action", "public">
      ? TanStackActionRouteMethod<TFunctionRef>
      : never;

type PluginTanStackExtensionsFromMeta<
  TConvexFunctions,
  TPluginMeta extends TanStackAuthPluginMeta,
> = TConvexFunctions extends { plugin: infer TPlugin }
  ? {
      plugin: {
        [TPluginName in keyof TPluginMeta & keyof TPlugin &
          string]: TPlugin[TPluginName] extends Record<string, unknown>
          ? {
              [TFunctionName in keyof TPluginMeta[TPluginName] &
                keyof TPlugin[TPluginName] &
                string]: TPlugin[TPluginName][TFunctionName] extends ConvexPluginFunctionRef
                ? TanStackMethodForKind<
                    TPlugin[TPluginName][TFunctionName],
                    TPluginMeta[TPluginName][TFunctionName]
                  >
                : never;
            }
          : never;
      };
    }
  : {};

export const DEFAULT_GENERATED_CORE_META = {
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

type CoreTanStackExtensionsFromMeta<
  TConvexFunctions,
  TCoreMeta extends TanStackAuthCoreMeta,
> = TConvexFunctions extends { core: infer TCore }
  ? {
      core: {
        [TFunctionName in keyof TCoreMeta & keyof TCore &
          string]: TCore[TFunctionName] extends ConvexPluginFunctionRef
          ? TanStackMethodForKind<TCore[TFunctionName], TCoreMeta[TFunctionName]>
          : never;
      };
    }
  : {};

type RootTanStackExtensionsFromCoreMeta<
  TConvexFunctions,
  TCoreMeta extends TanStackAuthCoreMeta,
> = TConvexFunctions extends { core: infer TCore }
  ? {
      [TFunctionName in keyof TCoreMeta & keyof TCore &
        string as TFunctionName extends ReservedAuthClientRootName
        ? never
        : TFunctionName]: TCore[TFunctionName] extends ConvexPluginFunctionRef
        ? TanStackMethodForKind<TCore[TFunctionName], TCoreMeta[TFunctionName]>
        : never;
    }
  : {};

export interface TanStackQueryAuthClientOptions<
  TPlugins extends readonly TanStackStartAuthApiClientPlugin<object>[] = [],
  TConvexFunctions extends Record<string, unknown> = Record<string, unknown>,
  TPluginMeta extends TanStackAuthPluginMeta = TanStackAuthPluginMeta,
  TCoreMeta extends TanStackAuthCoreMeta = typeof DEFAULT_GENERATED_CORE_META,
> extends TanStackStartAuthApiClientOptions<TPlugins, TConvexFunctions> {
  convexFunctions: TConvexFunctions;
  pluginMeta?: TPluginMeta;
  coreMeta?: TCoreMeta;
  meta?: TanStackAuthMeta;
}

export type TanStackQueryAuthClient<
  TPlugins extends readonly TanStackStartAuthApiClientPlugin<object>[],
  TConvexFunctions extends Record<string, unknown>,
  TPluginMeta extends TanStackAuthPluginMeta,
  TCoreMeta extends TanStackAuthCoreMeta = typeof DEFAULT_GENERATED_CORE_META,
> = TanStackStartAuthApiClientAuto<TPlugins, TConvexFunctions> &
  PluginTanStackExtensionsFromMeta<TConvexFunctions, TPluginMeta> &
  CoreTanStackExtensionsFromMeta<TConvexFunctions, TCoreMeta> &
  RootTanStackExtensionsFromCoreMeta<TConvexFunctions, TCoreMeta>;

interface RequestFailureContext {
  fallback: string;
}

export interface TanStackStartAuthApiClientPluginContext {
  basePath: string;
  credentials: RequestCredentials;
  requestJson: <T>(
    path: string,
    init: RequestInit,
    failure: RequestFailureContext
  ) => Promise<T>;
  requestVoid: (
    path: string,
    init: RequestInit,
    failure: RequestFailureContext
  ) => Promise<void>;
}

export interface TanStackStartAuthApiClientPlugin<TExtension extends object> {
  id: string;
  create: (context: TanStackStartAuthApiClientPluginContext) => TExtension;
}

export interface TanStackStartAuthApiClientOptions<
  TPlugins extends readonly TanStackStartAuthApiClientPlugin<object>[] = [],
  TConvexFunctions extends Record<string, unknown> | undefined = undefined,
> {
  basePath?: string;
  credentials?: RequestCredentials;
  fetch?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  convexFunctions?: TConvexFunctions;
  pluginMeta?: TanStackAuthPluginMeta;
  meta?: TanStackAuthMeta;
  plugins?: "auto" | TPlugins;
  runtime?: TanStackAuthRuntimeClientOptions;
  /**
   * @deprecated Use `runtime.sync` instead.
   */
  tokenSync?: boolean | TanStackAuthClientTokenSyncOptions;
}

export interface TanStackAuthClientTokenSyncOptions {
  enabled?: boolean;
  channelName?: string;
}

export interface TanStackAuthRuntimeClientOptions {
  storage?: "memory" | "localStorage" | AuthRuntimeStorage;
  sync?: false | "broadcast" | AuthRuntimeSync;
  refreshSkewMs?: number;
  maxUnauthorizedRefreshRetries?: number;
  debug?: boolean;
}

export interface TanStackOAuthSignInOptions {
  redirect?: boolean;
  redirectTo?: string;
  errorRedirectTo?: string;
}

export interface TanStackStartAuthApiClient extends ReactAuthClient {
  getToken: (options?: { forceRefresh?: boolean }) => Promise<string | null>;
  clearToken: () => void;
  connectConvexAuth: (
    convexClient: ConvexAuthClientLike
  ) => () => void;
  signOut: () => Promise<void>;
  signIn: {
    email: (input: SignInInput) => Promise<SessionInfo>;
    oauth: (
      providerId: OAuthProviderId,
      options?: TanStackOAuthSignInOptions
    ) => Promise<OAuthStartResult | null>;
  };
}

export type TanStackStartAuthApiClientWithPlugins<
  TPlugins extends readonly TanStackStartAuthApiClientPlugin<object>[],
> = TanStackStartAuthApiClient & PluginExtensions<TPlugins>;

export type TanStackStartAuthApiClientAuto<
  TPlugins extends readonly TanStackStartAuthApiClientPlugin<object>[],
  TConvexFunctions extends Record<string, unknown> | undefined,
> = TanStackStartAuthApiClientWithPlugins<TPlugins> &
  PluginClientExtensionsFromConvexFunctions<TConvexFunctions> &
  CoreClientExtensionsFromConvexFunctions<TConvexFunctions> &
  CoreRootAliasExtensionsFromConvexFunctions<TConvexFunctions>;

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

function isAbsoluteHttpUrl(value: string): boolean {
  return value.startsWith("http://") || value.startsWith("https://");
}

function hasFunctionRefCandidate(
  value: unknown
): value is FunctionReference<"query" | "mutation" | "action", "public"> {
  return value !== null && (typeof value === "object" || typeof value === "function");
}

function hasPluginFunctionRefs(convexFunctions: unknown): boolean {
  const pluginFunctions = readMember(convexFunctions, "plugin");
  if (
    pluginFunctions === null ||
    (typeof pluginFunctions !== "object" && typeof pluginFunctions !== "function")
  ) {
    return false;
  }
  return Object.keys(pluginFunctions as Record<string, unknown>).length > 0;
}

const RESERVED_CORE_ROOT_METHOD_NAMES = new Set<string>([
  "getSession",
  "getToken",
  "clearToken",
  "connectConvexAuth",
  "signOut",
  "signIn",
  "plugin",
  "core",
]);

function readMember(source: unknown, key: string): unknown {
  if (
    source === null ||
    (typeof source !== "object" && typeof source !== "function")
  ) {
    return undefined;
  }
  return (source as Record<string, unknown>)[key];
}

function resolvePluginMetaFromOptions(options: {
  pluginMeta?: TanStackAuthPluginMeta;
  meta?: TanStackAuthMeta;
}): TanStackAuthPluginMeta | undefined {
  return options.meta?.plugin ?? options.pluginMeta;
}

function resolveCoreMetaFromOptions(
  options: {
    coreMeta?: TanStackAuthCoreMeta;
    meta?: TanStackAuthMeta;
  }
): TanStackAuthCoreMeta {
  return options.meta?.core ?? options.coreMeta ?? DEFAULT_GENERATED_CORE_META;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function errorMessage(
  response: Response,
  payload: unknown,
  fallback: string
): string {
  if (
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    typeof (payload as AuthApiErrorPayload).error === "string"
  ) {
    return (payload as AuthApiErrorPayload).error as string;
  }
  return `${fallback} (${response.status})`;
}

function toSignInBody(input: SignInInput): Record<string, string> {
  const body: Record<string, string> = {
    email: input.email,
    password: input.password,
  };
  if (input.userAgent) {
    body.userAgent = input.userAgent;
  }
  return body;
}

function resolveRuntimeStorage(
  runtimeOptions: TanStackAuthRuntimeClientOptions | undefined
): AuthRuntimeStorage | undefined {
  const storageOption = runtimeOptions?.storage;
  if (storageOption === undefined || storageOption === "memory") {
    return undefined;
  }
  if (storageOption === "localStorage") {
    return createLocalStorageAuthStorage();
  }
  return storageOption;
}

function resolveRuntimeSync(
  runtimeOptions: TanStackAuthRuntimeClientOptions | undefined,
  tokenSyncOption: boolean | TanStackAuthClientTokenSyncOptions | undefined
): AuthRuntimeSync | undefined {
  const runtimeSyncOption = runtimeOptions?.sync;
  if (runtimeSyncOption !== undefined) {
    if (runtimeSyncOption === false) {
      return undefined;
    }
    if (runtimeSyncOption === "broadcast") {
      return createBroadcastAuthSync();
    }
    return runtimeSyncOption;
  }

  if (
    tokenSyncOption === true ||
    (typeof tokenSyncOption === "object" && tokenSyncOption.enabled !== false)
  ) {
    const channelName =
      typeof tokenSyncOption === "object" &&
      tokenSyncOption.channelName !== undefined
        ? tokenSyncOption.channelName
        : undefined;
    if (channelName !== undefined) {
      return createBroadcastAuthSync({ channelName });
    }
    return createBroadcastAuthSync();
  }

  return undefined;
}

type MutableCallable = ((input?: unknown) => Promise<unknown>) &
  Record<string, unknown>;

type ConvexQueryKeyPrefix = "convexQuery" | "convexAuthQuery";

const DEFAULT_QUERY_KEY_PREFIX: ConvexQueryKeyPrefix = "convexQuery";
const ROUTE_QUERY_KEY_PREFIX: ConvexQueryKeyPrefix = "convexAuthQuery";

function asMutableCallable(value: unknown): MutableCallable | null {
  if (typeof value !== "function") {
    return null;
  }
  return value as MutableCallable;
}

function hasStringName(value: unknown): value is { name: string } {
  if (value === null || typeof value !== "object") {
    return false;
  }
  if (!("name" in value)) {
    return false;
  }
  return typeof (value as { name?: unknown }).name === "string";
}

function toQueryKeyFunctionRef<
  TFunctionRef extends FunctionReference<"query" | "action", "public">,
>(functionRef: TFunctionRef): TFunctionRef {
  try {
    return getFunctionName(functionRef) as unknown as TFunctionRef;
  } catch {
    if (hasStringName(functionRef) && functionRef.name.length > 0) {
      return functionRef.name as unknown as TFunctionRef;
    }
    return functionRef;
  }
}

function withDefaultArgs<TFunctionRef extends ConvexPluginFunctionRef>(
  input: FunctionArgs<TFunctionRef> | undefined
): FunctionArgs<TFunctionRef> {
  if (input !== undefined) {
    return input;
  }
  return {} as FunctionArgs<TFunctionRef>;
}

function createConvexQueryOptions<
  TFunctionRef extends FunctionReference<"query", "public">,
>(
  functionRef: TFunctionRef,
  input?: FunctionArgs<TFunctionRef>,
  queryExecutor?: (
    input: FunctionArgs<TFunctionRef>
  ) => Promise<FunctionReturnType<TFunctionRef>>,
  queryKeyPrefix: ConvexQueryKeyPrefix = DEFAULT_QUERY_KEY_PREFIX
): ConvexQueryOptions<TFunctionRef, ConvexQueryKeyPrefix> {
  const args = withDefaultArgs(input);
  const options: ConvexQueryOptions<TFunctionRef, ConvexQueryKeyPrefix> = {
    queryKey: [queryKeyPrefix, toQueryKeyFunctionRef(functionRef), args],
    staleTime: Infinity,
  };
  if (queryExecutor) {
    options.queryFn = () => queryExecutor(args);
  }
  return options;
}

function createConvexActionOptions<
  TFunctionRef extends FunctionReference<"action", "public">,
>(
  functionRef: TFunctionRef,
  input?: FunctionArgs<TFunctionRef>
): ConvexActionOptions<TFunctionRef> {
  return {
    queryKey: [
      "convexAction",
      toQueryKeyFunctionRef(functionRef),
      withDefaultArgs(input),
    ],
    staleTime: Infinity,
  };
}

function attachQueryHelpers<
  TFunctionRef extends FunctionReference<"query", "public">,
>(
  routeMethod: MutableCallable,
  functionRef: TFunctionRef,
  queryExecutor?: (
    input: FunctionArgs<TFunctionRef>
  ) => Promise<FunctionReturnType<TFunctionRef>>,
  queryKeyPrefix: ConvexQueryKeyPrefix = DEFAULT_QUERY_KEY_PREFIX
): void {
  const queryOptions = (input?: FunctionArgs<TFunctionRef>) =>
    createConvexQueryOptions(functionRef, input, queryExecutor, queryKeyPrefix);
  routeMethod.query = queryOptions;
  routeMethod.queryOptions = queryOptions;
  routeMethod.suspenseQuery = queryOptions;
  routeMethod.prefetchQuery = async (
    queryClient: TanStackQueryClientLike,
    input?: FunctionArgs<TFunctionRef>
  ) => {
    await queryClient.prefetchQuery(queryOptions(input));
  };
  routeMethod.ensureQueryData = async (
    queryClient: TanStackQueryClientLike,
    input?: FunctionArgs<TFunctionRef>
  ) => {
    return queryClient.ensureQueryData<FunctionReturnType<TFunctionRef>>(
      queryOptions(input)
    );
  };
}

function attachMutationHelpers<
  TFunctionRef extends FunctionReference<"mutation", "public">,
>(routeMethod: MutableCallable, functionRef: TFunctionRef): void {
  const mutate = async (
    convex: ConvexMutationExecutorLike,
    input?: FunctionArgs<TFunctionRef>
  ): Promise<FunctionReturnType<TFunctionRef>> => {
    return convex.mutation(functionRef, withDefaultArgs(input));
  };
  routeMethod.mutationFn = (convex: ConvexMutationExecutorLike) => {
    return async (input?: FunctionArgs<TFunctionRef>) => mutate(convex, input);
  };
  routeMethod.mutate = mutate;
}

function attachActionHelpers<
  TFunctionRef extends FunctionReference<"action", "public">,
>(routeMethod: MutableCallable, functionRef: TFunctionRef): void {
  const queryOptions = (input?: FunctionArgs<TFunctionRef>) =>
    createConvexActionOptions(functionRef, input);
  routeMethod.query = queryOptions;
  routeMethod.queryOptions = queryOptions;
  routeMethod.suspenseQuery = queryOptions;
  routeMethod.prefetchQuery = async (
    queryClient: TanStackQueryClientLike,
    input?: FunctionArgs<TFunctionRef>
  ) => {
    await queryClient.prefetchQuery(queryOptions(input));
  };
  routeMethod.ensureQueryData = async (
    queryClient: TanStackQueryClientLike,
    input?: FunctionArgs<TFunctionRef>
  ) => {
    return queryClient.ensureQueryData<FunctionReturnType<TFunctionRef>>(
      queryOptions(input)
    );
  };
  const runAction = async (
    convex: ConvexActionExecutorLike,
    input?: FunctionArgs<TFunctionRef>
  ): Promise<FunctionReturnType<TFunctionRef>> => {
    return convex.action(functionRef, withDefaultArgs(input));
  };
  routeMethod.actionFn = (convex: ConvexActionExecutorLike) => {
    return async (input?: FunctionArgs<TFunctionRef>) => runAction(convex, input);
  };
  routeMethod.runAction = runAction;
}

/**
 * Build a browser auth client targeting TanStack Start auth API routes.
 *
 * Defaults to:
 * - basePath: `/api/auth`
 * - credentials: `same-origin`
 */
function createTanStackRouteAuthClient<
  TPlugins extends readonly TanStackStartAuthApiClientPlugin<object>[] = [],
  TConvexFunctions extends Record<string, unknown> | undefined = undefined,
>(
  options: TanStackStartAuthApiClientOptions<TPlugins, TConvexFunctions> = {}
): TanStackStartAuthApiClientAuto<TPlugins, TConvexFunctions> {
  const autoPluginsEnabled =
    options.plugins === undefined || options.plugins === "auto";
  const pluginMeta = resolvePluginMetaFromOptions(options);
  if (
    autoPluginsEnabled &&
    options.convexFunctions !== undefined &&
    hasPluginFunctionRefs(options.convexFunctions) &&
    pluginMeta === undefined
  ) {
    throw new Error(
      'createTanStackAuthClient requires "pluginMeta" when plugins is "auto" and convexFunctions is provided. ' +
        "Pass generated authMeta/authPluginMeta (convex/auth/metaGenerated.ts) " +
        'or disable auto plugins with plugins: [].'
    );
  }

  const basePath = normalizeBasePath(options.basePath ?? "/api/auth");
  const credentials = options.credentials ?? "same-origin";
  const fetchImpl = options.fetch ?? fetch;
  const plugins = (
    autoPluginsEnabled ? [] : options.plugins
  ) as readonly TanStackStartAuthApiClientPlugin<object>[];

  const resolveRequestUrl = async (path: string): Promise<string> => {
    const relativeUrl = `${basePath}/${path}`;
    if (isAbsoluteHttpUrl(relativeUrl) || typeof window !== "undefined") {
      return relativeUrl;
    }

    try {
      const moduleId = "@tanstack/react-start/server";
      const serverModule = (await import(
        /* @vite-ignore */ moduleId
      )) as {
        getRequestUrl: (opts?: {
          xForwardedHost?: boolean;
          xForwardedProto?: boolean;
        }) => URL;
      };
      const { getRequestUrl } = serverModule;
      const currentRequestUrl = getRequestUrl({
        xForwardedHost: true,
        xForwardedProto: true,
      });
      return new URL(relativeUrl, currentRequestUrl).toString();
    } catch {
      return relativeUrl;
    }
  };

  const request = async (
    path: string,
    init: RequestInit,
    failure: RequestFailureContext
  ): Promise<Response> => {
    const requestUrl = await resolveRequestUrl(path);
    const response = await fetchImpl(requestUrl, {
      ...init,
      credentials,
    });
    if (!response.ok) {
      const payload = await readJson(response);
      throw new Error(errorMessage(response, payload, failure.fallback));
    }
    return response;
  };

  const requestJson = async <T>(
    path: string,
    init: RequestInit,
    failure: RequestFailureContext
  ): Promise<T> => {
    const response = await request(path, init, failure);
    const payload = await readJson(response);
    return payload as T;
  };

  const requestVoid = async (
    path: string,
    init: RequestInit,
    failure: RequestFailureContext
  ): Promise<void> => {
    await request(path, init, failure);
  };

  const getSession = async (): Promise<SessionInfo | null> => {
    const payload = await requestJson<SessionResponsePayload | null>(
      "session",
      {
        method: "GET",
      },
      { fallback: "Could not load session" }
    );
    return payload?.session ?? null;
  };

  const runtimeStorage = resolveRuntimeStorage(options.runtime);
  const runtimeSync = resolveRuntimeSync(options.runtime, options.tokenSync);
  const runtime = createAuthRuntime({
    tokenProvider: {
      getToken: async () => {
        const payload = await requestJson<TokenResponsePayload | null>(
          "token",
          {
            method: "GET",
          },
          { fallback: "Could not load auth token" }
        );
        const tokenPayload: AuthTokenPayload = {
          token: payload?.token ?? null,
        };
        if (payload?.issuedAtMs !== undefined) {
          tokenPayload.issuedAtMs = payload.issuedAtMs;
        }
        if (payload?.expiresAtMs !== undefined) {
          tokenPayload.expiresAtMs = payload.expiresAtMs;
        }
        return tokenPayload;
      },
    },
    ...(runtimeStorage !== undefined ? { storage: runtimeStorage } : {}),
    ...(runtimeSync !== undefined ? { sync: runtimeSync } : {}),
    ...(options.runtime?.refreshSkewMs !== undefined
      ? { refreshSkewMs: options.runtime.refreshSkewMs }
      : {}),
    ...(options.runtime?.maxUnauthorizedRefreshRetries !== undefined
      ? {
          maxUnauthorizedRefreshRetries:
            options.runtime.maxUnauthorizedRefreshRetries,
        }
      : {}),
    ...(options.runtime?.debug !== undefined
      ? { debug: options.runtime.debug }
      : {}),
  });
  const clearToken = () => {
    void runtime.clear();
  };
  const getToken = async (
    tokenOptions?: { forceRefresh?: boolean }
  ): Promise<string | null> => {
    return runtime.getToken(tokenOptions);
  };

  const signInWithEmail = async (input: SignInInput): Promise<SessionInfo> => {
    const payload = await requestJson<SessionResponsePayload | null>(
      "sign-in-with-email",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(toSignInBody(input)),
      },
      { fallback: "Sign in failed" }
    );
    if (!payload?.session) {
      throw new Error("Sign in succeeded but no session was returned");
    }
    await runtime.onSignedIn();
    return payload.session;
  };

  const signOut = async (): Promise<void> => {
    await requestVoid(
      "sign-out",
      {
        method: "POST",
      },
      { fallback: "Sign out failed" }
    );
    await runtime.onSignedOut();
  };

  const signInWithOAuth = async (
    providerId: OAuthProviderId,
    oauthOptions: TanStackOAuthSignInOptions = {}
  ): Promise<OAuthStartResult | null> => {
    const searchParams = new URLSearchParams();
    if (oauthOptions.redirectTo) {
      searchParams.set("redirectTo", oauthOptions.redirectTo);
    }
    if (oauthOptions.errorRedirectTo) {
      searchParams.set("errorRedirectTo", oauthOptions.errorRedirectTo);
    }

    const shouldRedirect = oauthOptions.redirect !== false;
    const routePath = `sign-in/${providerId}`;

    if (shouldRedirect) {
      const requestUrl = await resolveRequestUrl(
        searchParams.size > 0
          ? `${routePath}?${searchParams.toString()}`
          : routePath
      );
      if (typeof window === "undefined") {
        throw new Error(
          "OAuth redirect sign-in requires a browser environment. Pass { redirect: false } to get the authorization URL."
        );
      }
      window.location.assign(requestUrl);
      return null;
    }

    searchParams.set("mode", "json");
    return await requestJson<OAuthStartResult>(
      `${routePath}?${searchParams.toString()}`,
      {
        method: "GET",
      },
      { fallback: `Could not start OAuth sign-in for ${providerId}` }
    );
  };

  const connectConvexAuth = (convexClient: ConvexAuthClientLike): (() => void) => {
    return runtime.mountConvex(convexClient);
  };

  const baseClient: TanStackStartAuthApiClient = {
    getSession,
    getToken,
    clearToken,
    connectConvexAuth,
    signOut,
    signIn: {
      email: signInWithEmail,
      oauth: signInWithOAuth,
    },
  };

  const pluginContext: TanStackStartAuthApiClientPluginContext = {
    basePath,
    credentials,
    requestJson,
    requestVoid,
  };

  const inferredPluginMethods: Record<string, unknown> = {};
  const shouldInferAutoPlugins =
    autoPluginsEnabled &&
    !!pluginMeta &&
    !!options.convexFunctions;
  if (shouldInferAutoPlugins) {
    const pluginFunctions = readMember(options.convexFunctions, "plugin");
    const pluginExtension: Record<string, unknown> = {};

    for (const [pluginName, functions] of Object.entries(pluginMeta)) {
      const pluginFunctionRefs = readMember(pluginFunctions, pluginName);
      const clientFunctions: Record<string, unknown> = {};

      for (const functionName of Object.keys(functions)) {
        const functionRef = readMember(pluginFunctionRefs, functionName);
        if (!hasFunctionRefCandidate(functionRef)) {
          throw new Error(
            `createTanStackAuthClient could not resolve "convexFunctions.plugin.${pluginName}.${functionName}".`
          );
        }

        const routePath = `plugin/${toKebabCase(pluginName)}/${toKebabCase(functionName)}`;
        clientFunctions[functionName] = async (input?: unknown) => {
          const requestBody = input === undefined ? {} : input;
          return requestJson<unknown>(
            routePath,
            {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(requestBody),
            },
            {
              fallback: `Could not call plugin method ${pluginName}.${functionName}`,
            }
          );
        };
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
  if (options.convexFunctions !== undefined) {
    const coreFunctions = readMember(options.convexFunctions, "core");
    if (
      coreFunctions &&
      (typeof coreFunctions === "object" || typeof coreFunctions === "function")
    ) {
      const metaCore = options.meta?.core;
      const coreFunctionNames =
        metaCore !== undefined
          ? Object.keys(metaCore)
          : Object.keys(coreFunctions as Record<string, unknown>);
      const coreExtension: Record<string, unknown> = {};
      for (const functionName of coreFunctionNames) {
        const functionRef = readMember(coreFunctions, functionName);
        if (!hasFunctionRefCandidate(functionRef)) {
          if (metaCore !== undefined) {
            throw new Error(
              `createTanStackAuthClient could not resolve "convexFunctions.core.${functionName}".`
            );
          }
          continue;
        }
        const routePath = `core/${toKebabCase(functionName)}`;
        coreExtension[functionName] = async (input?: unknown) => {
          const requestBody = input === undefined ? {} : input;
          return requestJson<unknown>(
            routePath,
            {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(requestBody),
            },
            {
              fallback: `Could not call core method ${functionName}`,
            }
          );
        };
      }

      if (Object.keys(coreExtension).length > 0) {
        inferredCoreMethods.core = coreExtension;
      }
    }
  }

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
  if (
    coreMethods &&
    (typeof coreMethods === "object" || typeof coreMethods === "function")
  ) {
    for (const [functionName, functionMethod] of Object.entries(
      coreMethods as Record<string, unknown>
    )) {
      const isReserved = RESERVED_CORE_ROOT_METHOD_NAMES.has(functionName);
      const alreadyExists = functionName in client;
      if (isReserved || alreadyExists) {
        const reason = isReserved
          ? "is a reserved authClient key"
          : "already exists on authClient";
        throw new Error(
          `createTanStackAuthClient could not alias "core.${functionName}" at authClient root because "${functionName}" ${reason}. ` +
            "Rename the core function to avoid conflicts."
        );
      }
      client[functionName] = functionMethod;
    }
  }

  return client as TanStackStartAuthApiClientAuto<TPlugins, TConvexFunctions>;
}

/**
 * Build a route-backed auth client and augment plugin/core methods with TanStack
 * query/mutation/action helpers.
 *
 * Session/sign-in/sign-out remain route-based (`/api/auth/*`), while plugin/core
 * methods also gain `.query()`, `.mutationFn()`, `.actionFn()`, etc.
 */
export function createTanStackAuthClient<
  TPlugins extends readonly TanStackStartAuthApiClientPlugin<object>[] = [],
  TConvexFunctions extends Record<string, unknown> | undefined = undefined,
>(
  options?: TanStackStartAuthApiClientOptions<TPlugins, TConvexFunctions>
): TanStackStartAuthApiClientAuto<TPlugins, TConvexFunctions>;
export function createTanStackAuthClient<
  TPlugins extends readonly TanStackStartAuthApiClientPlugin<object>[] = [],
  TConvexFunctions extends Record<string, unknown> = Record<string, unknown>,
  TPluginMeta extends TanStackAuthPluginMeta = TanStackAuthPluginMeta,
  TCoreMeta extends TanStackAuthCoreMeta = typeof DEFAULT_GENERATED_CORE_META,
>(
  options: TanStackQueryAuthClientOptions<
    TPlugins,
    TConvexFunctions,
    TPluginMeta,
    TCoreMeta
  >
): TanStackQueryAuthClient<TPlugins, TConvexFunctions, TPluginMeta, TCoreMeta>;
export function createTanStackAuthClient<
  TPlugins extends readonly TanStackStartAuthApiClientPlugin<object>[] = [],
  TConvexFunctions extends Record<string, unknown> | undefined = undefined,
  TPluginMeta extends TanStackAuthPluginMeta = TanStackAuthPluginMeta,
  TCoreMeta extends TanStackAuthCoreMeta = typeof DEFAULT_GENERATED_CORE_META,
>(
  options:
    | TanStackStartAuthApiClientOptions<TPlugins, TConvexFunctions>
    | TanStackQueryAuthClientOptions<
        TPlugins,
        Extract<TConvexFunctions, Record<string, unknown>>,
        TPluginMeta,
        TCoreMeta
      > = {}
):
  | TanStackStartAuthApiClientAuto<TPlugins, TConvexFunctions>
  | TanStackQueryAuthClient<
      TPlugins,
      Extract<TConvexFunctions, Record<string, unknown>>,
      TPluginMeta,
      TCoreMeta
    > {
  const authClient = createTanStackRouteAuthClient(
    options as TanStackStartAuthApiClientOptions<TPlugins, TConvexFunctions>
  );
  const queryOptions = options as TanStackQueryAuthClientOptions<
    TPlugins,
    Extract<TConvexFunctions, Record<string, unknown>>,
    TPluginMeta,
    TCoreMeta
  >;
  if (!("convexFunctions" in queryOptions) || !queryOptions.convexFunctions) {
    return authClient;
  }

  const hasPluginFns = hasPluginFunctionRefs(queryOptions.convexFunctions);
  const pluginMeta = resolvePluginMetaFromOptions(queryOptions);
  if (hasPluginFns && !pluginMeta) {
    throw new Error(
      'createTanStackAuthClient requires plugin metadata. Pass "meta" from convex/auth/metaGenerated.ts or "pluginMeta".'
    );
  }
  const clientPluginRoot = readMember(authClient, "plugin");
  if (hasPluginFns && pluginMeta && !clientPluginRoot) {
    throw new Error(
      'createTanStackAuthClient requires plugin route methods on authClient.plugin.*. ' +
        'Do not disable auto plugins with "plugins: []".'
    );
  }

  if (pluginMeta && clientPluginRoot) {
    const convexPluginRoot = readMember(queryOptions.convexFunctions, "plugin");
    for (const [pluginName, functions] of Object.entries(pluginMeta)) {
      const pluginClient = readMember(clientPluginRoot, pluginName);
      if (
        pluginClient === null ||
        (typeof pluginClient !== "object" && typeof pluginClient !== "function")
      ) {
        throw new Error(
          `createTanStackAuthClient could not resolve "authClient.plugin.${pluginName}".`
        );
      }
      const pluginFunctionRefs = readMember(convexPluginRoot, pluginName);

      for (const [functionName, functionKind] of Object.entries(functions)) {
        const routeMethod = asMutableCallable(readMember(pluginClient, functionName));
        if (!routeMethod) {
          throw new Error(
            `createTanStackAuthClient could not resolve "authClient.plugin.${pluginName}.${functionName}".`
          );
        }
        const functionRefCandidate = readMember(pluginFunctionRefs, functionName);
        if (!hasFunctionRefCandidate(functionRefCandidate)) {
          throw new Error(
            `createTanStackAuthClient could not resolve "convexFunctions.plugin.${pluginName}.${functionName}".`
          );
        }

        if (functionKind === "query") {
          const queryRef = functionRefCandidate as FunctionReference<"query", "public">;
          attachQueryHelpers(
            routeMethod,
            queryRef,
            async (input) => {
              return (await routeMethod(input)) as FunctionReturnType<typeof queryRef>;
            },
            ROUTE_QUERY_KEY_PREFIX
          );
          continue;
        }
        if (functionKind === "mutation") {
          attachMutationHelpers(
            routeMethod,
            functionRefCandidate as FunctionReference<"mutation", "public">
          );
          continue;
        }
        attachActionHelpers(
          routeMethod,
          functionRefCandidate as FunctionReference<"action", "public">
        );
      }
    }
  }

  const coreMeta = resolveCoreMetaFromOptions(queryOptions);
  const explicitCoreMeta =
    queryOptions.coreMeta !== undefined || queryOptions.meta !== undefined;
  const clientCoreRoot = readMember(authClient, "core");
  const convexCoreRoot = readMember(queryOptions.convexFunctions, "core");
  if (explicitCoreMeta && convexCoreRoot && !clientCoreRoot) {
    throw new Error(
      'createTanStackAuthClient requires core route methods on authClient.core.* when "coreMeta" or "meta" is provided.'
    );
  }
  if (clientCoreRoot && convexCoreRoot) {
    for (const [functionName, functionKind] of Object.entries(coreMeta)) {
      const coreMethod = asMutableCallable(readMember(clientCoreRoot, functionName));
      const functionRefCandidate = readMember(convexCoreRoot, functionName);
      if (!coreMethod || !hasFunctionRefCandidate(functionRefCandidate)) {
        if (explicitCoreMeta) {
          throw new Error(
            `createTanStackAuthClient could not resolve core helper target "${functionName}".`
          );
        }
        continue;
      }

      if (functionKind === "query") {
        const queryRef = functionRefCandidate as FunctionReference<"query", "public">;
        attachQueryHelpers(
          coreMethod,
          queryRef,
          async (input) => {
            return (await coreMethod(input)) as FunctionReturnType<typeof queryRef>;
          },
          ROUTE_QUERY_KEY_PREFIX
        );
        continue;
      }
      if (functionKind === "mutation") {
        attachMutationHelpers(
          coreMethod,
          functionRefCandidate as FunctionReference<"mutation", "public">
        );
        continue;
      }
      attachActionHelpers(
        coreMethod,
        functionRefCandidate as FunctionReference<"action", "public">
      );
    }
  }

  return authClient as TanStackQueryAuthClient<
    TPlugins,
    Extract<TConvexFunctions, Record<string, unknown>>,
    TPluginMeta,
    TCoreMeta
  >;
}
