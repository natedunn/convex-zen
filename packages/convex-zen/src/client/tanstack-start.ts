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

export interface TanStackStartAuthOptions {
  primitives: SessionPrimitives;
  cookieName?: string;
  cookieOptions?: Partial<SetCookieOptions>;
}

export interface TanStackStartConvexActions {
  /** Email/password sign-in action. */
  signInWithEmail: FunctionReference<"action", "public">;
  validateSession: FunctionReference<"action", "public">;
  signOut: FunctionReference<"action", "public">;
}

export interface TanStackStartConvexAuthOptions {
  convexUrl: string;
  actions: TanStackStartConvexActions;
  cookieName?: string;
  cookieOptions?: Partial<SetCookieOptions>;
}

export interface TanStackStartConvexReactStartOptions
  extends TanStackStartConvexAuthOptions {
  authApiBasePath?: string;
  plugins?: readonly TanStackStartAuthApiPluginFactory[];
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
}

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

function resolveCookieOptions(
  options?: Partial<SetCookieOptions>
): SetCookieOptions {
  return {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: false,
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

function readClientIp(request: Request): string | undefined {
  const forwarded = request.headers.get("x-forwarded-for");
  if (typeof forwarded === "string" && forwarded.length > 0) {
    const [first] = forwarded.split(",");
    const ip = first?.trim();
    if (ip) {
      return ip;
    }
  }
  const realIp = request.headers.get("x-real-ip");
  return realIp && realIp.length > 0 ? realIp : undefined;
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

    const session = await options.primitives.getSessionFromToken(token);
    if (!session) {
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
    setCookie(cookieName, established.sessionToken, cookieOptions);
    return established.session;
  };

  const signOut = async () => {
    const { deleteCookie } = await import("@tanstack/react-start/server");
    const token = await getCookieToken();
    try {
      await options.primitives.signOutByToken(token);
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
 * Supported actions:
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
      if (request.method === "GET" && action === "session") {
        const session = await options.tanstackAuth.getSession();
        return json({ session });
      }

      if (request.method === "POST" && action === "sign-in-with-email") {
        const body = (await readRequestBody()) as {
          email?: unknown;
          password?: unknown;
          ipAddress?: unknown;
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
        if (typeof body.ipAddress === "string" && body.ipAddress.length > 0) {
          signInInput.ipAddress = body.ipAddress;
        } else {
          const requestIp = readClientIp(request);
          if (requestIp) {
            signInInput.ipAddress = requestIp;
          }
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
 * Build TanStack Start auth handlers directly from Convex public action refs.
 *
 * This removes transport boilerplate in app code while keeping session logic
 * fully based on Convex functions.
 */
export function createTanStackStartConvexAuth(
  options: TanStackStartConvexAuthOptions
): TanStackStartAuth {
  const convex = new ConvexHttpClient(options.convexUrl);
  const primitives = createSessionPrimitives({
    signIn: async (input) => {
      return (await convex.action(options.actions.signInWithEmail, input)) as SignInOutput;
    },
    validateSession: async (token) => {
      return (await convex.action(options.actions.validateSession, {
        token,
      })) as SessionInfo | null;
    },
    signOut: async (token) => {
      await convex.action(options.actions.signOut, { token });
    },
  });
  const adapterOptions: TanStackStartAuthOptions = { primitives };
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
export function convexZenReactStart(
  options: TanStackStartConvexReactStartOptions
): TanStackStartConvexReactStart {
  const tanstackAuth = createTanStackStartConvexAuth(options);
  const fetchers = createTanStackStartConvexFetchers({
    tanstackAuth,
    convexUrl: options.convexUrl,
  });
  const authApiPlugins =
    options.plugins?.map((plugin) =>
      plugin.create({
        tanstackAuth,
        fetchers,
      })
    ) ?? [];
  const authApiHandlerOptions: TanStackStartAuthApiHandlerOptions = {
    tanstackAuth,
    plugins: authApiPlugins,
  };
  if (options.authApiBasePath !== undefined) {
    authApiHandlerOptions.basePath = options.authApiBasePath;
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
