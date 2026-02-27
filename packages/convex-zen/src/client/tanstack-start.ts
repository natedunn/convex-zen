import { ConvexHttpClient } from "convex/browser";
import type {
  FunctionArgs,
  FunctionReference,
  FunctionReturnType,
} from "convex/server";
import type {
  deleteCookie as deleteCookieFn,
  setCookie as setCookieFn,
} from "@tanstack/react-start/server";
import {
  createConvexZenIdentityJwt,
  type SessionTokenCodec,
} from "./tanstack-start-identity-jwt";
import type { TanStackAuthPluginMeta } from "./tanstack-start-plugin-meta";
import { pluginApiPlugin } from "./tanstack-start-plugins";
import {
  createSessionPrimitives,
  type SessionInfo,
  type SessionPrimitives,
  type SignInInput,
  type SignInOutput,
} from "./primitives";

type SetCookieOptions = Exclude<Parameters<typeof setCookieFn>[2], undefined>;
type DeleteCookieOptions = Exclude<
  Parameters<typeof deleteCookieFn>[1],
  undefined
>;
type MaybePromise<T> = T | Promise<T>;
const DEFAULT_COOKIE_MAX_AGE_SECONDS = 14 * 24 * 60 * 60;

export interface TanStackStartAuthOptions {
  primitives: SessionPrimitives;
  cookieName?: string;
  cookieOptions?: Partial<SetCookieOptions>;
  sessionTokenCodec?: SessionTokenCodec;
}

export interface TanStackStartConvexActions {
  /** Email/password sign-in mutation. */
  signInWithEmail: FunctionReference<"mutation", "public">;
  validateSession: FunctionReference<"mutation", "public">;
  signOut: FunctionReference<"mutation", "public">;
}

export type TanStackStartConvexActionRefs =
  | TanStackStartConvexActions
  | ({
      core: TanStackStartConvexActions;
      plugin?: Record<string, Record<string, unknown>>;
    } & Record<string, unknown>);

export interface TanStackStartConvexAuthOptions {
  convexUrl: string;
  convexFunctions: TanStackStartConvexActionRefs;
  cookieName?: string;
  cookieOptions?: Partial<SetCookieOptions>;
  sessionTokenCodec?: SessionTokenCodec;
}

export type TanStackAuthApiPluginSelection =
  | "auto"
  | readonly TanStackStartAuthApiPluginFactory[];

export interface TanStackStartConvexReactStartOptions
  extends TanStackStartConvexAuthOptions {
  authApiBasePath?: string;
  /**
   * Auth API route plugins.
   * - `"auto"` (default): infer supported built-ins from `convexFunctions`.
   * - array: explicit plugin factories.
   */
  plugins?: TanStackAuthApiPluginSelection;
  /**
   * Generated plugin function metadata.
   * Required for generic auto plugin routing (`/api/auth/plugin/*`).
   */
  pluginMeta?: TanStackAuthPluginMeta;
  /**
   * Additional trusted origins allowed for non-GET auth API requests.
   * Same-origin is always trusted.
   */
  trustedOrigins?: TrustedOriginsConfig;
  /**
   * Whether `/api/auth/*` handlers should trust proxy-forwarded client IP headers.
   * Default: `false` (secure by default).
   */
  trustedProxy?: TrustedProxyConfig;
  /**
   * Optional custom client-IP resolver for sign-in requests.
   * Returned values are sanitized before use.
   */
  getClientIp?: ClientIpResolver;
}

export interface AuthenticatedSession {
  token: string;
  session: SessionInfo;
}

export interface TanStackStartAuth {
  getSession: () => Promise<SessionInfo | null>;
  getToken: () => Promise<string | null>;
  signIn: (input: SignInInput) => Promise<SessionInfo>;
  signOut: () => Promise<void>;
  requireSession: () => Promise<AuthenticatedSession>;
  withSession: <T>(
    handler: (auth: AuthenticatedSession) => Promise<T>
  ) => Promise<T>;
}

export interface TanStackStartSessionHandlers {
  getSession: () => Promise<SessionInfo | null>;
  getToken: () => Promise<string | null>;
  requireSession: () => Promise<AuthenticatedSession>;
  withSession: <T>(
    handler: (auth: AuthenticatedSession) => Promise<T>
  ) => Promise<T>;
}

export interface TanStackStartAuthHandlers {
  signInWithEmail: (input: SignInInput) => Promise<SessionInfo>;
  signOut: () => Promise<void>;
}

export interface TanStackStartAuthApiHandlerOptions {
  tanstackAuth: Pick<TanStackStartAuth, "getSession" | "signIn" | "signOut">;
  basePath?: string;
  plugins?: readonly TanStackStartAuthApiPlugin[];
  trustedOrigins?: TrustedOriginsConfig;
  trustedProxy?: TrustedProxyConfig;
  getClientIp?: ClientIpResolver;
}

export type TrustedOriginsConfig =
  | readonly string[]
  | ((request: Request) => MaybePromise<readonly string[]>);

export type TrustedProxyConfig =
  | boolean
  | ((request: Request) => boolean);

export interface ResolveClientIpContext {
  trustProxy: boolean;
  readForwardedIp: () => string | undefined;
  readRealIp: () => string | undefined;
}

export type ClientIpResolver = (
  request: Request,
  context: ResolveClientIpContext
) => string | undefined;

export interface TanStackStartAuthApiPluginContext {
  request: Request;
  method: string;
  action: string;
  readJson: () => Promise<unknown>;
  json: (data: unknown, status?: number) => Response;
}

export interface TanStackStartAuthApiPlugin {
  id: string;
  handle: (
    context: TanStackStartAuthApiPluginContext
  ) => Promise<Response | null> | Response | null;
}

export interface TanStackStartAuthApiPluginFactoryContext {
  tanstackAuth: TanStackAuthForPluginFactory;
  fetchers: TanStackStartConvexFetchers;
  convexFunctions: Record<string, unknown>;
}

type TanStackAuthForPluginFactory = Pick<
  TanStackStartAuth,
  "getSession" | "getToken" | "signIn" | "signOut" | "requireSession" | "withSession"
>;

export interface TanStackStartAuthApiPluginFactory {
  id: string;
  create: (
    context: TanStackStartAuthApiPluginFactoryContext
  ) => TanStackStartAuthApiPlugin;
}

export interface TanStackStartConvexFetchers {
  fetchAuthQuery: <Query extends FunctionReference<"query", "public">>(
    fn: Query,
    args: FunctionArgs<Query>
  ) => Promise<FunctionReturnType<Query>>;
  fetchAuthMutation: <Mutation extends FunctionReference<"mutation", "public">>(
    fn: Mutation,
    args: FunctionArgs<Mutation>
  ) => Promise<FunctionReturnType<Mutation>>;
  fetchAuthAction: <Action extends FunctionReference<"action", "public">>(
    fn: Action,
    args: FunctionArgs<Action>
  ) => Promise<FunctionReturnType<Action>>;
}

export interface TanStackStartConvexFetchersOptions {
  tanstackAuth: Pick<TanStackStartAuth, "requireSession">;
  convexUrl: string;
}

export interface TanStackStartConvexReactStart
  extends TanStackStartAuth,
    TanStackStartConvexFetchers {
  handler: (request: Request) => Promise<Response>;
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
  convexFunctions: TanStackStartConvexActionRefs,
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
  actionName: "signInWithEmail" | "validateSession" | "signOut"
): FunctionReference<"mutation", "public"> {
  if (!hasFunctionRefCandidate(value)) {
    throw new Error(
      `createTanStackAuthServer could not resolve "${actionName}" function. ` +
        `Pass flat convexFunctions ({ ${actionName}, ... }) or nested convexFunctions ({ core: { ${actionName}, ... } }).`
    );
  }
  return value as FunctionReference<"mutation", "public">;
}

function resolveCoreActions(
  convexFunctions: TanStackStartConvexActionRefs
): TanStackStartConvexActions {
  return {
    signInWithEmail: asMutationActionRef(
      resolveNamedConvexFunctionRef(convexFunctions, "signInWithEmail", "core"),
      "signInWithEmail"
    ),
    validateSession: asMutationActionRef(
      resolveNamedConvexFunctionRef(convexFunctions, "validateSession", "core"),
      "validateSession"
    ),
    signOut: asMutationActionRef(
      resolveNamedConvexFunctionRef(convexFunctions, "signOut", "core"),
      "signOut"
    ),
  };
}

function hasPluginMeta(pluginMeta: TanStackAuthPluginMeta | undefined): boolean {
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

function isProductionRuntime(): boolean {
  const env = (
    globalThis as { process?: { env?: Record<string, string | undefined> } }
  ).process?.env;
  return env?.NODE_ENV === "production";
}

function resolveCookieOptions(
  options?: Partial<SetCookieOptions>
): SetCookieOptions {
  return {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: isProductionRuntime(),
    maxAge: DEFAULT_COOKIE_MAX_AGE_SECONDS,
    ...options,
  };
}

type AuthApiErrorPayload = { error?: string };

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
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

function normalizeOrigin(origin: string): string | null {
  try {
    return new URL(origin).origin;
  } catch {
    return null;
  }
}

async function resolveTrustedOrigins(
  request: Request,
  trustedOrigins: TrustedOriginsConfig | undefined
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
  trustedProxy: TrustedProxyConfig | undefined
): boolean {
  if (typeof trustedProxy === "function") {
    return trustedProxy(request);
  }
  return trustedProxy === true;
}

function resolveClientIp(
  request: Request,
  options: Pick<TanStackStartAuthApiHandlerOptions, "trustedProxy" | "getClientIp">
): string | undefined {
  const trustProxy = shouldTrustProxy(request, options.trustedProxy);
  const resolverContext: ResolveClientIpContext = {
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
  trustedOrigins: TrustedOriginsConfig | undefined
): Promise<boolean> {
  const originHeader = request.headers.get("origin");
  if (!originHeader) {
    // Non-browser clients may not send Origin.
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
    typeof (error as AuthApiErrorPayload).error === "string"
  ) {
    return (error as AuthApiErrorPayload).error as string;
  }
  return "Authentication request failed";
}

/**
 * TanStack Start adapter.
 *
 * Exposes server-side auth handlers that read/write an HttpOnly session cookie
 * and delegate auth logic to framework-agnostic SessionPrimitives.
 *
 * These handlers are meant to be wrapped by route-local `createServerFn(...)`
 * so TanStack's server function transform runs in application code.
 */
export function createTanStackStartAuth(
  options: TanStackStartAuthOptions
): TanStackStartAuth {
  const cookieName = options.cookieName ?? "cz_session";
  const cookieOptions = resolveCookieOptions(options.cookieOptions);
  const clearCookieOptions: DeleteCookieOptions = {
    path: cookieOptions.path ?? "/",
  };
  const sessionTokenCodec = options.sessionTokenCodec;
  const unauthorizedError = () => new Error("Unauthorized");
  const getCookieToken = async () => {
    const { getCookie } = await import("@tanstack/react-start/server");
    return getCookie(cookieName);
  };

  const resolveAuthenticatedSession = async (): Promise<AuthenticatedSession | null> => {
    const { deleteCookie } = await import("@tanstack/react-start/server");
    const token = await getCookieToken();
    if (!token) {
      return null;
    }

    let sessionToken = token;
    let expectedUserId: string | null = null;
    if (sessionTokenCodec) {
      const decoded = await sessionTokenCodec.decode(token);
      if (!decoded) {
        deleteCookie(cookieName, clearCookieOptions);
        return null;
      }
      sessionToken = decoded.sessionToken;
      expectedUserId = decoded.userId;
    }

    const session = await options.primitives.getSessionFromToken(sessionToken);
    if (!session) {
      deleteCookie(cookieName, clearCookieOptions);
      return null;
    }
    if (expectedUserId !== null && session.userId !== expectedUserId) {
      deleteCookie(cookieName, clearCookieOptions);
      return null;
    }

    return { token, session };
  };

  const getSession = async () => {
    return (await resolveAuthenticatedSession())?.session ?? null;
  };

  const getToken = async () => {
    return (await resolveAuthenticatedSession())?.token ?? null;
  };

  const signIn = async (input: SignInInput) => {
    const { setCookie } = await import("@tanstack/react-start/server");
    const established = await options.primitives.signInAndResolveSession(input);
    const cookieToken = sessionTokenCodec
      ? await sessionTokenCodec.encode({
          userId: established.session.userId,
          sessionToken: established.sessionToken,
        })
      : established.sessionToken;
    setCookie(cookieName, cookieToken, cookieOptions);
    return established.session;
  };

  const signOut = async () => {
    const { deleteCookie } = await import("@tanstack/react-start/server");
    const token = await getCookieToken();
    let sessionToken = token;
    if (token && sessionTokenCodec) {
      const decoded = await sessionTokenCodec.decode(token);
      sessionToken = decoded?.sessionToken;
    }
    try {
      await options.primitives.signOutByToken(sessionToken);
    } finally {
      deleteCookie(cookieName, clearCookieOptions);
    }
  };

  const requireSession = async (): Promise<AuthenticatedSession> => {
    const authenticated = await resolveAuthenticatedSession();
    if (!authenticated) {
      throw unauthorizedError();
    }
    return authenticated;
  };

  const withSession = async <T>(
    handler: (auth: AuthenticatedSession) => Promise<T>
  ): Promise<T> => {
    return handler(await requireSession());
  };

  return {
    getSession,
    getToken,
    signIn,
    signOut,
    requireSession,
    withSession,
  };
}

/** Build route-friendly session handlers from a TanStack auth instance. */
export function createTanStackStartSessionHandlers(
  tanstackAuth: TanStackStartAuth
): TanStackStartSessionHandlers {
  return {
    getSession: async () => tanstackAuth.getSession(),
    getToken: async () => tanstackAuth.getToken(),
    requireSession: async () => tanstackAuth.requireSession(),
    withSession: async <T>(handler: (auth: AuthenticatedSession) => Promise<T>) =>
      tanstackAuth.withSession(handler),
  };
}

/** Build route-friendly auth mutation handlers from a TanStack auth instance. */
export function createTanStackStartAuthHandlers(
  tanstackAuth: TanStackStartAuth
): TanStackStartAuthHandlers {
  return {
    signInWithEmail: async (input) => tanstackAuth.signIn(input),
    signOut: async () => tanstackAuth.signOut(),
  };
}

/**
 * Build a Request handler for `/api/auth/*` routes in TanStack Start.
 *
 * Supported endpoints:
 * - `GET /api/auth/session`
 * - `POST /api/auth/sign-in-with-email`
 * - `POST /api/auth/sign-out`
 */
export function createTanStackStartAuthApiHandler(
  options: TanStackStartAuthApiHandlerOptions
): (request: Request) => Promise<Response> {
  const basePath = normalizeBasePath(options.basePath ?? "/api/auth");
  const plugins = options.plugins ?? [];

  return async (request: Request): Promise<Response> => {
    const action = resolveActionFromPath(new URL(request.url).pathname, basePath);
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
      if (
        request.method !== "GET" &&
        !(await isAllowedOriginRequest(request, options.trustedOrigins))
      ) {
        return json({ error: "Forbidden origin" }, 403);
      }

      if (request.method === "GET" && action === "session") {
        const session = await options.tanstackAuth.getSession();
        return json({ session });
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

        const session = await options.tanstackAuth.signIn(signInInput);
        return json({ session });
      }

      if (request.method === "POST" && action === "sign-out") {
        await options.tanstackAuth.signOut();
        return json({ ok: true });
      }

      const pluginContext: TanStackStartAuthApiPluginContext = {
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
 * Build authenticated Convex fetch helpers for TanStack Start server functions.
 * Each call resolves auth from cookies via `requireSession`.
 */
export function createTanStackStartConvexFetchers(
  options: TanStackStartConvexFetchersOptions
): TanStackStartConvexFetchers {
  const withAuthenticatedConvexClient = async <T>(
    runner: (client: ConvexHttpClient) => Promise<T>
  ): Promise<T> => {
    const { token } = await options.tanstackAuth.requireSession();
    const convex = new ConvexHttpClient(options.convexUrl);
    convex.setAuth(token);
    return runner(convex);
  };

  return {
    fetchAuthQuery: async (fn, args) => {
      return withAuthenticatedConvexClient((convex) => convex.query(fn, args));
    },
    fetchAuthMutation: async (fn, args) => {
      return withAuthenticatedConvexClient((convex) => convex.mutation(fn, args));
    },
    fetchAuthAction: async (fn, args) => {
      return withAuthenticatedConvexClient((convex) => convex.action(fn, args));
    },
  };
}

/**
 * Build TanStack Start auth handlers directly from Convex public mutation refs.
 *
 * This removes transport boilerplate in app code while keeping session logic
 * fully based on Convex functions.
 */
export function createTanStackStartConvexAuth(
  options: TanStackStartConvexAuthOptions
): TanStackStartAuth {
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
      await convex.mutation(coreActions.signOut, { token });
    },
  });
  const adapterOptions: TanStackStartAuthOptions = {
    primitives,
    sessionTokenCodec:
      options.sessionTokenCodec ??
      createConvexZenIdentityJwt().sessionTokenCodec,
  };
  if (options.cookieName !== undefined) {
    adapterOptions.cookieName = options.cookieName;
  }
  if (options.cookieOptions !== undefined) {
    adapterOptions.cookieOptions = options.cookieOptions;
  }
  return createTanStackStartAuth(adapterOptions);
}

/**
 * Better-auth-style TanStack Start helper for convex-zen.
 *
 * Returns a single object containing:
 * - auth route `handler` (`/api/auth/*`)
 * - token/session helpers (`getSession`, `getToken`, ...)
 * - authenticated Convex fetchers (`fetchAuthQuery`, `fetchAuthMutation`, `fetchAuthAction`)
 */
export function createTanStackAuthServer(
  options: TanStackStartConvexReactStartOptions
): TanStackStartConvexReactStart {
  const autoPluginsEnabled =
    options.plugins === undefined || options.plugins === "auto";
  if (autoPluginsEnabled && options.pluginMeta === undefined) {
    throw new Error(
      'createTanStackAuthServer requires "pluginMeta" when plugins is "auto". ' +
        "Pass generated authPluginMeta (convex/auth/plugin/metaGenerated.ts) " +
        'or disable auto plugins with plugins: [].'
    );
  }

  const tanstackAuth = createTanStackStartConvexAuth(options);
  const fetchers = createTanStackStartConvexFetchers({
    tanstackAuth,
    convexUrl: options.convexUrl,
  });
  const autoPluginFactories: TanStackStartAuthApiPluginFactory[] = [];
  if (hasPluginMeta(options.pluginMeta)) {
    autoPluginFactories.push(
      pluginApiPlugin({
        pluginMeta: options.pluginMeta as TanStackAuthPluginMeta,
      })
    );
  }
  const pluginFactories = (
    autoPluginsEnabled ? autoPluginFactories : options.plugins
  ) as readonly TanStackStartAuthApiPluginFactory[];
  const authApiPlugins = pluginFactories.map((plugin) =>
    plugin.create({
      tanstackAuth,
      fetchers,
      convexFunctions: options.convexFunctions as Record<string, unknown>,
    })
  );
  const authApiHandlerOptions: TanStackStartAuthApiHandlerOptions = {
    tanstackAuth,
    plugins: authApiPlugins,
  };
  if (options.authApiBasePath !== undefined) {
    authApiHandlerOptions.basePath = options.authApiBasePath;
  }
  if (options.trustedOrigins !== undefined) {
    authApiHandlerOptions.trustedOrigins = options.trustedOrigins;
  }
  if (options.trustedProxy !== undefined) {
    authApiHandlerOptions.trustedProxy = options.trustedProxy;
  }
  if (options.getClientIp !== undefined) {
    authApiHandlerOptions.getClientIp = options.getClientIp;
  }
  const handler = createTanStackStartAuthApiHandler(authApiHandlerOptions);

  return {
    getSession: tanstackAuth.getSession,
    getToken: tanstackAuth.getToken,
    signIn: tanstackAuth.signIn,
    signOut: tanstackAuth.signOut,
    requireSession: tanstackAuth.requireSession,
    withSession: tanstackAuth.withSession,
    fetchAuthQuery: fetchers.fetchAuthQuery,
    fetchAuthMutation: fetchers.fetchAuthMutation,
    fetchAuthAction: fetchers.fetchAuthAction,
    handler,
  };
}
