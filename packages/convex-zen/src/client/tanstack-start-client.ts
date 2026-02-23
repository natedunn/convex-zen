import type { SessionInfo, SignInInput } from "./primitives";
import type { ReactAuthClient } from "./react";

export interface TanStackStartAuthServerFns {
  getSession: () => Promise<SessionInfo | null>;
}

interface AuthApiErrorPayload {
  error?: string;
}

interface SessionResponsePayload {
  session?: SessionInfo | null;
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
  TPlugins extends readonly TanStackStartAuthApiClientPlugin<object>[] = readonly TanStackStartAuthApiClientPlugin<object>[],
> {
  basePath?: string;
  credentials?: RequestCredentials;
  fetch?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  plugins?: TPlugins;
}

export interface TanStackStartAuthApiClient extends ReactAuthClient {
  signInWithEmail: (input: SignInInput) => Promise<SessionInfo>;
  signOut: () => Promise<void>;
  signIn: {
    email: (input: SignInInput) => Promise<SessionInfo>;
  };
}

export type TanStackStartAuthApiClientWithPlugins<
  TPlugins extends readonly TanStackStartAuthApiClientPlugin<object>[],
> = TanStackStartAuthApiClient & PluginExtensions<TPlugins>;

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
  if (input.ipAddress) {
    body.ipAddress = input.ipAddress;
  }
  if (input.userAgent) {
    body.userAgent = input.userAgent;
  }
  return body;
}

/**
 * Build a ConvexZen React auth client from TanStack Start server functions.
 */
export function createTanStackStartReactAuthClient(
  serverFns: TanStackStartAuthServerFns
): ReactAuthClient {
  return {
    getSession: async () => {
      return await serverFns.getSession();
    },
  };
}

/**
 * Build a browser auth client targeting TanStack Start auth API routes.
 *
 * Defaults to:
 * - basePath: `/api/auth`
 * - credentials: `same-origin`
 */
export function createTanStackStartAuthApiClient<
  TPlugins extends readonly TanStackStartAuthApiClientPlugin<object>[] = [],
>(
  options: TanStackStartAuthApiClientOptions<TPlugins> = {}
): TanStackStartAuthApiClientWithPlugins<TPlugins> {
  const basePath = normalizeBasePath(options.basePath ?? "/api/auth");
  const credentials = options.credentials ?? "same-origin";
  const fetchImpl = options.fetch ?? fetch;
  const plugins = options.plugins ?? [];

  const request = async (
    path: string,
    init: RequestInit,
    failure: RequestFailureContext
  ): Promise<Response> => {
    const response = await fetchImpl(`${basePath}/${path}`, {
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
  };

  const baseClient: TanStackStartAuthApiClient = {
    getSession,
    signInWithEmail,
    signOut,
    signIn: {
      email: signInWithEmail,
    },
  };

  const pluginContext: TanStackStartAuthApiClientPluginContext = {
    basePath,
    credentials,
    requestJson,
    requestVoid,
  };

  const pluginExtensions: Record<string, unknown> = {};
  for (const plugin of plugins) {
    Object.assign(pluginExtensions, plugin.create(pluginContext));
  }

  return {
    ...baseClient,
    ...pluginExtensions,
  } as TanStackStartAuthApiClientWithPlugins<TPlugins>;
}
