import type { AuthTokenPayload } from "./auth-token-manager";
import {
  createAuthRuntime,
  createBroadcastAuthSync,
  createLocalStorageAuthStorage,
  type AuthRuntimeStorage,
  type AuthRuntimeSync,
  type ConvexAuthClientLike,
} from "./auth-runtime";
import type { SessionInfo, SignInInput } from "./primitives";
import type { ReactAuthClient } from "./react";
import type { OAuthProviderId, OAuthStartResult } from "../types";

type MaybePromise<T> = T | Promise<T>;

export interface RouteAuthClientTokenSyncOptions {
  enabled?: boolean;
  channelName?: string;
}

export interface RouteAuthRuntimeClientOptions {
  storage?: "memory" | "localStorage" | AuthRuntimeStorage;
  sync?: false | "broadcast" | AuthRuntimeSync;
  refreshSkewMs?: number;
  maxUnauthorizedRefreshRetries?: number;
  debug?: boolean;
}

export interface RouteAuthRoutePaths {
  session: string;
  token: string;
  signInWithEmail: string;
  signOut: string;
}

export interface RouteAuthResolveRequestUrlContext {
  basePath: string;
}

export interface RouteAuthRuntimeAdapterOptions {
  basePath?: string;
  credentials?: RequestCredentials;
  fetch?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  runtime?: RouteAuthRuntimeClientOptions;
  /**
   * @deprecated Use `runtime.sync` instead.
   */
  tokenSync?: boolean | RouteAuthClientTokenSyncOptions;
  routes?: Partial<RouteAuthRoutePaths>;
  toSignInBody?: (input: SignInInput) => unknown;
  resolveRequestUrl?: (
    path: string,
    context: RouteAuthResolveRequestUrlContext
  ) => MaybePromise<string>;
}

export interface RouteAuthRuntimeAdapterClient extends ReactAuthClient {
  getToken: (options?: { forceRefresh?: boolean }) => Promise<string | null>;
  clearToken: () => void;
  connectConvexAuth: (convexClient: ConvexAuthClientLike) => () => void;
  signOut: () => Promise<void>;
  signIn: {
    email: (input: SignInInput) => Promise<SessionInfo>;
    oauth: (
      providerId: OAuthProviderId,
      options?: RouteAuthOAuthSignInOptions
    ) => Promise<OAuthStartResult | null>;
  };
}

export interface RouteAuthOAuthSignInOptions {
  redirect?: boolean;
  redirectTo?: string;
  errorRedirectTo?: string;
}

interface RouteAuthSessionResponse {
  session?: SessionInfo | null;
}

interface RouteAuthTokenResponse {
  token?: string | null;
  issuedAtMs?: number;
  expiresAtMs?: number;
}

interface RouteAuthErrorResponse {
  error?: string;
}

interface RequestFailureContext {
  fallback: string;
}

const DEFAULT_ROUTE_PATHS: RouteAuthRoutePaths = {
  session: "session",
  token: "token",
  signInWithEmail: "sign-in-with-email",
  signOut: "sign-out",
};

function isAbsoluteHttpUrl(value: string): boolean {
  return value.startsWith("http://") || value.startsWith("https://");
}

function normalizeBasePath(path: string): string {
  const normalized = path.trim();
  if (normalized === "") {
    return "/api/auth";
  }

  if (isAbsoluteHttpUrl(normalized)) {
    if (normalized.length > 1 && normalized.endsWith("/")) {
      return normalized.slice(0, -1);
    }
    return normalized;
  }

  const withLeadingSlash = normalized.startsWith("/")
    ? normalized
    : `/${normalized}`;
  if (withLeadingSlash.length > 1 && withLeadingSlash.endsWith("/")) {
    return withLeadingSlash.slice(0, -1);
  }
  return withLeadingSlash;
}

function normalizeRoutePath(path: string): string {
  const trimmed = path.trim();
  if (trimmed === "") {
    throw new Error("Route path must not be empty");
  }
  return trimmed.replace(/^\/+/, "");
}

function normalizeRoutePaths(
  paths: Partial<RouteAuthRoutePaths> | undefined
): RouteAuthRoutePaths {
  return {
    session: normalizeRoutePath(paths?.session ?? DEFAULT_ROUTE_PATHS.session),
    token: normalizeRoutePath(paths?.token ?? DEFAULT_ROUTE_PATHS.token),
    signInWithEmail: normalizeRoutePath(
      paths?.signInWithEmail ?? DEFAULT_ROUTE_PATHS.signInWithEmail
    ),
    signOut: normalizeRoutePath(paths?.signOut ?? DEFAULT_ROUTE_PATHS.signOut),
  };
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
    typeof (payload as RouteAuthErrorResponse).error === "string"
  ) {
    return (payload as RouteAuthErrorResponse).error as string;
  }
  return `${fallback} (${response.status})`;
}

function resolveRuntimeStorage(
  runtimeOptions: RouteAuthRuntimeClientOptions | undefined
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
  runtimeOptions: RouteAuthRuntimeClientOptions | undefined,
  tokenSyncOption: boolean | RouteAuthClientTokenSyncOptions | undefined
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

function toDefaultSignInBody(input: SignInInput): Record<string, string> {
  const body: Record<string, string> = {
    email: input.email,
    password: input.password,
  };
  if (input.userAgent) {
    body.userAgent = input.userAgent;
  }
  return body;
}

/**
 * Shared route + runtime auth client factory that framework adapters can wrap.
 */
export function createRouteAuthRuntimeAdapter(
  options: RouteAuthRuntimeAdapterOptions = {}
): RouteAuthRuntimeAdapterClient {
  const basePath = normalizeBasePath(options.basePath ?? "/api/auth");
  const credentials = options.credentials ?? "same-origin";
  const fetchImpl = options.fetch ?? fetch;
  const routePaths = normalizeRoutePaths(options.routes);

  const resolveRequestUrl = async (path: string): Promise<string> => {
    if (options.resolveRequestUrl) {
      return await options.resolveRequestUrl(path, { basePath });
    }
    return `${basePath}/${path}`;
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

  const runtimeStorage = resolveRuntimeStorage(options.runtime);
  const runtimeSync = resolveRuntimeSync(options.runtime, options.tokenSync);

  const runtime = createAuthRuntime({
    tokenProvider: {
      getToken: async () => {
        const payload = await requestJson<RouteAuthTokenResponse | null>(
          routePaths.token,
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

  const getSession = async (): Promise<SessionInfo | null> => {
    const payload = await requestJson<RouteAuthSessionResponse | null>(
      routePaths.session,
      {
        method: "GET",
      },
      { fallback: "Could not load session" }
    );
    return payload?.session ?? null;
  };

  const getToken = async (
    tokenOptions?: { forceRefresh?: boolean }
  ): Promise<string | null> => {
    return runtime.getToken(tokenOptions);
  };

  const clearToken = () => {
    void runtime.clear();
  };

  const signInWithEmail = async (input: SignInInput): Promise<SessionInfo> => {
    const payload = await requestJson<RouteAuthSessionResponse | null>(
      routePaths.signInWithEmail,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify((options.toSignInBody ?? toDefaultSignInBody)(input)),
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
      routePaths.signOut,
      {
        method: "POST",
      },
      { fallback: "Sign out failed" }
    );
    await runtime.onSignedOut();
  };

  const signInWithOAuth = async (
    providerId: OAuthProviderId,
    oauthOptions: RouteAuthOAuthSignInOptions = {}
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

  return {
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
}
