import { ConvexHttpClient } from "convex/browser";
import type {
  FunctionArgs,
  FunctionReference,
  FunctionReturnType,
} from "convex/server";
import {
  buildDirectConvexClientExtensions,
  hasFunctionRefCandidate,
  readMember,
  type DirectConvexCoreExtensionsFromMeta,
  type DirectConvexCoreMeta,
  type DirectConvexFunctionKind,
  type DirectConvexMeta,
  type DirectConvexPluginExtensionsFromMeta,
  type DirectConvexPluginMeta,
  type DirectConvexRootAliasExtensionsFromMeta,
} from "./convex-direct-client-methods.js";
import {
  createAuthRuntime,
  createKeyValueStorageAuthStorage,
  createMemoryAuthStorage,
  type AuthRuntimeStorage,
  type AuthRuntimeSync,
  type ConvexAuthClientLike,
} from "./auth-runtime.js";
import type { AuthTokenPayload } from "./auth-token-manager.js";
export {
  type AuthKeyValueStorage,
  type AuthRuntimeStorage,
  type AuthRuntimeSync,
  type ConvexAuthClientLike,
  type KeyValueAuthStorageOptions,
} from "./auth-runtime.js";
export { createKeyValueStorageAuthStorage, createMemoryAuthStorage };
import {
  createSessionPrimitives,
  type SessionInfo,
  type SignInInput,
  type SignInOutput,
} from "./primitives.js";
import type { ReactAuthClient } from "./react.js";
import type { OAuthProviderId, OAuthStartResult } from "../types.js";

type PublicMutationRef = FunctionReference<"mutation", "public">;
type PublicActionRef = FunctionReference<"action", "public">;
type ExpoPublicFunctionRef = FunctionReference<ExpoAuthFunctionKind, "public">;
type ReservedExpoAuthClientRootName =
  | "getSession"
  | "getToken"
  | "clearToken"
  | "connectConvexAuth"
  | "establishSession"
  | "signOut"
  | "signIn"
  | "completeOAuth"
  | "plugin"
  | "core";

const EXPO_RESERVED_CORE_ROOT_METHOD_NAMES = new Set<ReservedExpoAuthClientRootName>([
  "getSession",
  "getToken",
  "clearToken",
  "connectConvexAuth",
  "establishSession",
  "signOut",
  "signIn",
  "completeOAuth",
  "plugin",
  "core",
]);

const EXPO_CORE_METHODS_WITH_SESSION_TOKEN_ARG = new Set(["currentUser"]);

export type ExpoAuthFunctionKind = DirectConvexFunctionKind;
export type ExpoAuthCoreMeta = DirectConvexCoreMeta;
export type ExpoAuthPluginMeta = DirectConvexPluginMeta;
export type ExpoAuthMeta = DirectConvexMeta;

export const DEFAULT_EXPO_CORE_META = {
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
} as const satisfies ExpoAuthCoreMeta;

function resolveNamedConvexFunctionRef(
  convexFunctions: Record<string, unknown>,
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

function asMutationRef(
  value: unknown,
  functionName:
    | "signInWithEmail"
    | "validateSession"
    | "invalidateSession"
    | "getOAuthUrl"
): PublicMutationRef {
  if (!hasFunctionRefCandidate(value)) {
    throw new Error(
      `createExpoAuthClient could not resolve "${functionName}" function. ` +
        `Pass flat convexFunctions ({ ${functionName}, ... }) or nested convexFunctions ({ core: { ${functionName}, ... } }).`
    );
  }
  return value as PublicMutationRef;
}

function asActionRef(
  value: unknown,
  functionName: "handleOAuthCallback"
): PublicActionRef {
  if (!hasFunctionRefCandidate(value)) {
    throw new Error(
      `createExpoAuthClient could not resolve "${functionName}" function. ` +
        `Pass flat convexFunctions ({ ${functionName}, ... }) or nested convexFunctions ({ core: { ${functionName}, ... } }).`
    );
  }
  return value as PublicActionRef;
}

function resolveCoreActions(
  convexFunctions: Record<string, unknown>
): ExpoConvexActions {
  return {
    signInWithEmail: asMutationRef(
      resolveNamedConvexFunctionRef(convexFunctions, "signInWithEmail", "core"),
      "signInWithEmail"
    ),
    validateSession: asMutationRef(
      resolveNamedConvexFunctionRef(convexFunctions, "validateSession", "core"),
      "validateSession"
    ),
    invalidateSession: asMutationRef(
      resolveNamedConvexFunctionRef(convexFunctions, "invalidateSession", "core"),
      "invalidateSession"
    ),
  };
}

function resolveOAuthActions(
  convexFunctions: Record<string, unknown>
): ExpoOAuthActions {
  return {
    getOAuthUrl: asMutationRef(
      resolveNamedConvexFunctionRef(convexFunctions, "getOAuthUrl", "core"),
      "getOAuthUrl"
    ),
    handleOAuthCallback: asActionRef(
      resolveNamedConvexFunctionRef(convexFunctions, "handleOAuthCallback", "core"),
      "handleOAuthCallback"
    ),
  };
}

export interface ExpoAuthRuntimeClientOptions {
  storage?: AuthRuntimeStorage;
  sync?: false | AuthRuntimeSync;
  refreshSkewMs?: number;
  maxUnauthorizedRefreshRetries?: number;
  debug?: boolean;
}

export interface ExpoOAuthSignInOptions {
  callbackUrl: string;
  redirectTo?: string;
  errorRedirectTo?: string;
}

export interface ExpoOAuthCallbackInput {
  providerId: OAuthProviderId;
  code: string;
  state: string;
  callbackUrl?: string;
  redirectTo?: string;
  errorRedirectTo?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface ExpoOAuthResult {
  session: SessionInfo;
  redirectTo?: string;
}

export interface ExpoAuthClientBase extends ReactAuthClient {
  getToken: (options?: { forceRefresh?: boolean }) => Promise<string | null>;
  clearToken: () => void;
  connectConvexAuth: (convexClient: ConvexAuthClientLike) => () => void;
  establishSession: (sessionToken: string) => Promise<SessionInfo>;
  signOut: () => Promise<void>;
  signIn: {
    email: (input: SignInInput) => Promise<SessionInfo>;
    oauth: (
      providerId: OAuthProviderId,
      options: ExpoOAuthSignInOptions
    ) => Promise<OAuthStartResult>;
  };
  completeOAuth: (input: ExpoOAuthCallbackInput) => Promise<ExpoOAuthResult>;
}

export type ExpoAuthClient<
  TConvexFunctions extends Record<string, unknown> = ExpoConvexFunctionRefs,
  TPluginMeta extends ExpoAuthPluginMeta = {},
  TCoreMeta extends ExpoAuthCoreMeta = {},
> = ExpoAuthClientBase &
  DirectConvexPluginExtensionsFromMeta<TConvexFunctions, TPluginMeta> &
  DirectConvexCoreExtensionsFromMeta<TConvexFunctions, TCoreMeta> &
  DirectConvexRootAliasExtensionsFromMeta<
    TConvexFunctions,
    TCoreMeta,
    ReservedExpoAuthClientRootName
  >;

export interface ExpoConvexActions {
  signInWithEmail: PublicMutationRef;
  validateSession: PublicMutationRef;
  invalidateSession: PublicMutationRef;
}

export interface ExpoOAuthActions {
  getOAuthUrl: PublicMutationRef;
  handleOAuthCallback: PublicActionRef;
}

export interface ExpoConvexFunctionRefs extends Record<string, unknown> {
  signInWithEmail?: PublicMutationRef;
  validateSession?: PublicMutationRef;
  invalidateSession?: PublicMutationRef;
  getOAuthUrl?: PublicMutationRef;
  handleOAuthCallback?: PublicActionRef;
  core?: Record<string, unknown> & {
    signInWithEmail?: PublicMutationRef;
    validateSession?: PublicMutationRef;
    invalidateSession?: PublicMutationRef;
    getOAuthUrl?: PublicMutationRef;
    handleOAuthCallback?: PublicActionRef;
  };
  plugin?: Record<string, Record<string, unknown> | undefined>;
}

export interface ExpoAuthClientOptions<
  TConvexFunctions extends Record<string, unknown> = ExpoConvexFunctionRefs,
  TPluginMeta extends ExpoAuthPluginMeta = {},
  TCoreMeta extends ExpoAuthCoreMeta = {},
> {
  convexUrl: string;
  convexFunctions: TConvexFunctions;
  runtime?: ExpoAuthRuntimeClientOptions;
  meta?: {
    plugin?: TPluginMeta;
    core?: TCoreMeta;
  };
  pluginMeta?: TPluginMeta;
  coreMeta?: TCoreMeta;
}

/**
 * Native-friendly Convex auth client for Expo and other client-storage flows.
 *
 * This adapter stores the session token in app-provided storage, validates it
 * directly against Convex public functions, and exposes manual OAuth helpers
 * for deep-link based flows.
 */
export function createExpoAuthClient<
  TConvexFunctions extends Record<string, unknown> = ExpoConvexFunctionRefs,
  TPluginMeta extends ExpoAuthPluginMeta = {},
  TCoreMeta extends ExpoAuthCoreMeta = {},
>(
  options: ExpoAuthClientOptions<TConvexFunctions, TPluginMeta, TCoreMeta>
): ExpoAuthClient<TConvexFunctions, TPluginMeta, TCoreMeta> {
  const convexFunctions = options.convexFunctions as Record<string, unknown>;
  const coreActions = resolveCoreActions(convexFunctions);
  const convex = new ConvexHttpClient(options.convexUrl);
  const storage = options.runtime?.storage;
  let currentTokenPayload: AuthTokenPayload | null = null;

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

  const runtime = createAuthRuntime({
    tokenProvider: {
      getToken: async () => {
        if (currentTokenPayload !== null) {
          return currentTokenPayload;
        }
        if (storage) {
          const storedPayload = await storage.get();
          if (storedPayload) {
            return storedPayload;
          }
        }
        return { token: null };
      },
    },
    ...(storage !== undefined ? { storage } : {}),
    ...(options.runtime?.sync !== undefined && options.runtime.sync !== false
      ? { sync: options.runtime.sync }
      : {}),
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

  const establishSession = async (sessionToken: string): Promise<SessionInfo> => {
    const session = await primitives.getSessionFromToken(sessionToken);
    if (!session) {
      throw new Error("Could not validate session token");
    }
    currentTokenPayload = { token: sessionToken };
    await runtime.onSignedIn();
    return session;
  };

  const getToken = async (
    tokenOptions?: { forceRefresh?: boolean }
  ): Promise<string | null> => {
    return runtime.getToken(tokenOptions);
  };

  const getSession = async (): Promise<SessionInfo | null> => {
    const token = await runtime.getToken();
    if (!token) {
      return null;
    }
    const session = await primitives.getSessionFromToken(token);
    if (session) {
      return session;
    }
    currentTokenPayload = { token: null };
    await runtime.clear();
    return null;
  };

  const clearToken = (): void => {
    currentTokenPayload = { token: null };
    void runtime.clear();
  };

  const signOut = async (): Promise<void> => {
    const token = await runtime.getToken();
    await primitives.signOutByToken(token);
    currentTokenPayload = { token: null };
    await runtime.onSignedOut();
  };

  const signInWithEmail = async (input: SignInInput): Promise<SessionInfo> => {
    const established = await primitives.signInAndResolveSession(input);
    currentTokenPayload = { token: established.sessionToken };
    await runtime.onSignedIn();
    return established.session;
  };

  const signInWithOAuth = async (
    providerId: OAuthProviderId,
    oauthOptions: ExpoOAuthSignInOptions
  ): Promise<OAuthStartResult> => {
    const oauthActions = resolveOAuthActions(convexFunctions);
    return (await convex.mutation(oauthActions.getOAuthUrl, {
      providerId,
      callbackUrl: oauthOptions.callbackUrl,
      redirectTo: oauthOptions.redirectTo,
      errorRedirectTo: oauthOptions.errorRedirectTo,
    })) as OAuthStartResult;
  };

  const completeOAuth = async (
    input: ExpoOAuthCallbackInput
  ): Promise<ExpoOAuthResult> => {
    const oauthActions = resolveOAuthActions(convexFunctions);
    const result = (await convex.action(oauthActions.handleOAuthCallback, {
      providerId: input.providerId,
      code: input.code,
      state: input.state,
      callbackUrl: input.callbackUrl,
      redirectTo: input.redirectTo,
      errorRedirectTo: input.errorRedirectTo,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    })) as { sessionToken?: unknown; redirectTo?: unknown; redirectUrl?: unknown };

    if (typeof result.sessionToken !== "string") {
      throw new Error("OAuth callback did not return a session token");
    }

    const session = await establishSession(result.sessionToken);
    const redirectTo =
      typeof result.redirectTo === "string"
        ? result.redirectTo
        : typeof result.redirectUrl === "string"
          ? result.redirectUrl
          : undefined;

    return {
      session,
      ...(redirectTo !== undefined ? { redirectTo } : {}),
    };
  };

  const connectConvexAuth = (convexClient: ConvexAuthClientLike): (() => void) => {
    return runtime.mountConvex(convexClient);
  };

  const directConvexClient = new ConvexHttpClient(options.convexUrl);

  const callDirectConvexFunction = async <
    TFunctionRef extends ExpoPublicFunctionRef,
  >(
    kind: ExpoAuthFunctionKind,
    functionRef: TFunctionRef,
    input?: FunctionArgs<TFunctionRef>
  ): Promise<FunctionReturnType<TFunctionRef>> => {
    const args = (input ?? {}) as FunctionArgs<TFunctionRef>;
    switch (kind) {
      case "query":
        return (await directConvexClient.query(
          functionRef as FunctionReference<"query", "public">,
          args as FunctionArgs<FunctionReference<"query", "public">>
        )) as FunctionReturnType<TFunctionRef>;
      case "mutation":
        return (await directConvexClient.mutation(
          functionRef as FunctionReference<"mutation", "public">,
          args as FunctionArgs<FunctionReference<"mutation", "public">>
        )) as FunctionReturnType<TFunctionRef>;
      case "action":
        return (await directConvexClient.action(
          functionRef as FunctionReference<"action", "public">,
          args as FunctionArgs<FunctionReference<"action", "public">>
        )) as FunctionReturnType<TFunctionRef>;
    }
  };

  const baseClient: ExpoAuthClientBase = {
    getSession,
    getToken,
    clearToken,
    connectConvexAuth,
    establishSession,
    signOut,
    signIn: {
      email: signInWithEmail,
      oauth: signInWithOAuth,
    },
    completeOAuth,
  };

  const directExtensions = buildDirectConvexClientExtensions({
    clientName: "createExpoAuthClient",
    convexFunctions,
    reservedCoreRootMethodNames: EXPO_RESERVED_CORE_ROOT_METHOD_NAMES,
    existingRootNames: new Set(Object.keys(baseClient)),
    ...(options.meta?.core !== undefined || options.coreMeta !== undefined
      ? { coreMeta: options.meta?.core ?? options.coreMeta }
      : {}),
    ...(options.meta?.plugin !== undefined || options.pluginMeta !== undefined
      ? { pluginMeta: options.meta?.plugin ?? options.pluginMeta }
      : {}),
    createMethod: (kind, functionRef, path) => {
      return async (input?: unknown) => {
        let resolvedInput = input;
        const functionName = path.startsWith("core.")
          ? path.slice("core.".length)
          : null;
        if (
          functionName &&
          EXPO_CORE_METHODS_WITH_SESSION_TOKEN_ARG.has(functionName)
        ) {
          const token = await runtime.getToken();
          if (token) {
            const baseInput =
              input && typeof input === "object" ? input : {};
            const tokenValue = (baseInput as { token?: unknown }).token;
            if (tokenValue === undefined) {
              resolvedInput = {
                ...(baseInput as Record<string, unknown>),
                token,
              };
            }
          }
        }
        return callDirectConvexFunction(
          kind,
          functionRef as ExpoPublicFunctionRef,
          resolvedInput as FunctionArgs<ExpoPublicFunctionRef>
        );
      };
    },
  });

  return {
    ...baseClient,
    ...directExtensions,
  } as ExpoAuthClient<TConvexFunctions, TPluginMeta, TCoreMeta>;
}
