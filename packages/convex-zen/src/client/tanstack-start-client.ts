import type { SessionInfo, SignInInput } from "./primitives";
import type { ReactAuthClient } from "./react";
import type {
  FunctionArgs,
  FunctionReference,
  FunctionReturnType,
} from "convex/server";
import type { TanStackAuthPluginMeta } from "./tanstack-start-plugin-meta";
import { toKebabCase } from "./tanstack-start-plugin-meta";

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
  plugins?: "auto" | TPlugins;
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

export type TanStackStartAuthApiClientAuto<
  TPlugins extends readonly TanStackStartAuthApiClientPlugin<object>[],
  TConvexFunctions extends Record<string, unknown> | undefined,
> = TanStackStartAuthApiClientWithPlugins<TPlugins> &
  PluginClientExtensionsFromConvexFunctions<TConvexFunctions>;

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

function readMember(source: unknown, key: string): unknown {
  if (
    source === null ||
    (typeof source !== "object" && typeof source !== "function")
  ) {
    return undefined;
  }
  return (source as Record<string, unknown>)[key];
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
export function createTanStackAuthClient<
  TPlugins extends readonly TanStackStartAuthApiClientPlugin<object>[] = [],
  TConvexFunctions extends Record<string, unknown> | undefined = undefined,
>(
  options: TanStackStartAuthApiClientOptions<TPlugins, TConvexFunctions> = {}
): TanStackStartAuthApiClientAuto<TPlugins, TConvexFunctions> {
  const autoPluginsEnabled =
    options.plugins === undefined || options.plugins === "auto";
  if (
    autoPluginsEnabled &&
    options.convexFunctions !== undefined &&
    options.pluginMeta === undefined
  ) {
    throw new Error(
      'createTanStackAuthClient requires "pluginMeta" when plugins is "auto" and convexFunctions is provided. ' +
        "Pass generated authPluginMeta (convex/auth/plugin/metaGenerated.ts) " +
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

  const inferredPluginMethods: Record<string, unknown> = {};
  const shouldInferAutoPlugins =
    autoPluginsEnabled &&
    !!options.pluginMeta &&
    !!options.convexFunctions;
  if (shouldInferAutoPlugins) {
    const pluginMeta = options.pluginMeta as TanStackAuthPluginMeta;
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

  const pluginExtensions: Record<string, unknown> = {};
  for (const plugin of plugins) {
    Object.assign(pluginExtensions, plugin.create(pluginContext));
  }

  return {
    ...baseClient,
    ...inferredPluginMethods,
    ...pluginExtensions,
  } as TanStackStartAuthApiClientAuto<TPlugins, TConvexFunctions>;
}
