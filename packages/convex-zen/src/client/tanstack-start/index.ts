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
} from "../identity-jwt";
import type {
  AuthCoreMeta,
  AuthMeta,
  AuthPluginMeta,
} from "../plugin-meta";
import { coreApiPlugin, pluginApiPlugin } from "./plugins";
import {
  createSessionPrimitives,
  type SessionInfo,
  type SessionPrimitives,
  type SignInInput,
  type SignInOutput,
} from "../primitives";
import { createConvexFetchers } from "../convex-fetchers";
import type { OAuthProviderId } from "../../types";
import {
  isRecord,
  hasFunctionRefCandidate,
  readMember,
  hasPluginFunctionRefs,
} from "../helpers";

type SetCookieOptions = Exclude<Parameters<typeof setCookieFn>[2], undefined>;
type DeleteCookieOptions = Exclude<
  Parameters<typeof deleteCookieFn>[1],
  undefined
>;
type MaybePromise<T> = T | Promise<T>;
const DEFAULT_COOKIE_MAX_AGE_SECONDS = 14 * 24 * 60 * 60;
const TANSTACK_START_SERVER_MODULE_ID = "@tanstack/react-start/server";

type TanStackStartServerModule = {
  getCookie: (name: string) => string | undefined;
  setCookie: typeof setCookieFn;
  deleteCookie: typeof deleteCookieFn;
};

type TanStackStartOAuthActionRefs = {
  getOAuthUrl: FunctionReference<"mutation", "public">;
  handleOAuthCallback: FunctionReference<"action", "public">;
};

type TanStackStartOAuthStateCookiePayload = {
  state: string;
  providerId: OAuthProviderId;
  redirectTo: string;
  errorRedirectTo: string;
};

type TanStackStartOAuthCallbackResult = {
  sessionToken?: unknown;
  redirectTo?: unknown;
  redirectUrl?: unknown;
};

const TANSTACK_OAUTH_STATE_COOKIE_NAME = "cz_oauth_state";
const TANSTACK_OAUTH_STATE_COOKIE_MAX_AGE_SECONDS = 10 * 60;

// Keep this dynamic to avoid bundling TanStack server internals into client code.
async function loadTanStackStartServerModule(): Promise<TanStackStartServerModule> {
  const moduleId = TANSTACK_START_SERVER_MODULE_ID;
  return (await import(
    /* @vite-ignore */ moduleId
  )) as TanStackStartServerModule;
}

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
  invalidateSession: FunctionReference<"mutation", "public">;
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
  pluginMeta?: AuthPluginMeta;
  /**
   * Generated core function metadata.
   * Enables deterministic core route mapping for proxy-shaped Convex refs.
   */
  coreMeta?: AuthCoreMeta;
  /**
   * Generated auth metadata (`core` + `plugin`) from `convex/zen/_generated/meta.ts`.
   */
  meta?: AuthMeta;
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
  establishSession: (sessionToken: string) => Promise<SessionInfo>;
  signOut: () => Promise<void>;
  requireSession: () => Promise<AuthenticatedSession>;
  withSession: <T>(
    handler: (auth: AuthenticatedSession) => Promise<T>
  ) => Promise<T>;
}

export interface TanStackStartAuthApiHandlerOptions {
  tanstackAuth: Pick<
    TanStackStartAuth,
    "getSession" | "getToken" | "signIn" | "establishSession" | "signOut"
  >;
  basePath?: string;
  plugins?: readonly TanStackStartAuthApiPlugin[];
  trustedOrigins?: TrustedOriginsConfig;
  trustedProxy?: TrustedProxyConfig;
  getClientIp?: ClientIpResolver;
  convexFunctions?: Record<string, unknown>;
  coreMeta?: AuthCoreMeta;
  fetchers?: Pick<TanStackStartConvexFetchers, "fetchAction" | "fetchMutation">;
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
  | "getSession"
  | "getToken"
  | "signIn"
  | "establishSession"
  | "signOut"
  | "requireSession"
  | "withSession"
>;

export interface TanStackStartAuthApiPluginFactory {
  id: string;
  create: (
    context: TanStackStartAuthApiPluginFactoryContext
  ) => TanStackStartAuthApiPlugin;
}

export interface TanStackStartConvexFetchers {
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
  actionName: "signInWithEmail" | "validateSession" | "invalidateSession"
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
    invalidateSession: asMutationActionRef(
      resolveNamedConvexFunctionRef(convexFunctions, "invalidateSession", "core"),
      "invalidateSession"
    ),
  };
}

function hasPluginMeta(pluginMeta: AuthPluginMeta | undefined): boolean {
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
  options: Pick<TanStackStartConvexReactStartOptions, "meta" | "pluginMeta">
): AuthPluginMeta | undefined {
  return options.meta?.plugin ?? options.pluginMeta;
}

function resolveCoreMeta(
  options: Pick<TanStackStartConvexReactStartOptions, "meta" | "coreMeta">
): AuthCoreMeta | undefined {
  return options.meta?.core ?? options.coreMeta;
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

function jsonNoStore(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      pragma: "no-cache",
      expires: "0",
    },
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

function resolveOAuthActionRefs(
  convexFunctions: Record<string, unknown> | undefined
): TanStackStartOAuthActionRefs | null {
  if (!convexFunctions) {
    return null;
  }

  const getOAuthUrl = resolveNamedConvexFunctionRef(
    convexFunctions as TanStackStartConvexActionRefs,
    "getOAuthUrl",
    "core"
  );
  const handleOAuthCallback = resolveNamedConvexFunctionRef(
    convexFunctions as TanStackStartConvexActionRefs,
    "handleOAuthCallback",
    "core"
  );
  if (!hasFunctionRefCandidate(getOAuthUrl) || !hasFunctionRefCandidate(handleOAuthCallback)) {
    return null;
  }

  return {
    getOAuthUrl: getOAuthUrl as FunctionReference<"mutation", "public">,
    handleOAuthCallback: handleOAuthCallback as FunctionReference<
      "action",
      "public"
    >,
  };
}

function buildTanStackOAuthCallbackUrl(
  request: Request,
  basePath: string,
  providerId: OAuthProviderId
): string {
  return new URL(`${basePath}/callback/${providerId}`, request.url).toString();
}

function parseOAuthStateCookie(
  request: Request
): TanStackStartOAuthStateCookiePayload | null {
  const rawCookie = readCookie(request, TANSTACK_OAUTH_STATE_COOKIE_NAME);
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

async function setOAuthStateCookie(
  basePath: string,
  payload: TanStackStartOAuthStateCookiePayload
): Promise<void> {
  const { setCookie } = await loadTanStackStartServerModule();
  setCookie(TANSTACK_OAUTH_STATE_COOKIE_NAME, JSON.stringify(payload), {
    ...resolveCookieOptions({
      path: basePath,
      maxAge: TANSTACK_OAUTH_STATE_COOKIE_MAX_AGE_SECONDS,
    }),
  });
}

async function clearOAuthStateCookie(basePath: string): Promise<void> {
  const { deleteCookie } = await loadTanStackStartServerModule();
  deleteCookie(TANSTACK_OAUTH_STATE_COOKIE_NAME, {
    path: basePath,
  });
}

function createRedirectResponse(request: Request, location: string): Response {
  return new Response(null, {
    status: 302,
    headers: {
      location: new URL(location, request.url).toString(),
    },
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

async function createOAuthErrorRedirectResponse(args: {
  request: Request;
  providerId: OAuthProviderId;
  error: string;
  description?: string | undefined;
  target?: string | undefined;
  clearStateCookie?: boolean;
  basePath: string;
}): Promise<Response> {
  if (args.clearStateCookie) {
    await clearOAuthStateCookie(args.basePath);
  }
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
  return createRedirectResponse(args.request, redirectTarget.toString());
}

function parseOAuthCallbackResult(
  value: unknown
): TanStackStartOAuthCallbackResult | null {
  if (!isRecord(value)) {
    return null;
  }
  return value as TanStackStartOAuthCallbackResult;
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
function createTanStackStartAuth(
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
    const { getCookie } = await loadTanStackStartServerModule();
    return getCookie(cookieName);
  };

  const resolveAuthenticatedSession = async (): Promise<AuthenticatedSession | null> => {
    const { deleteCookie } = await loadTanStackStartServerModule();
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
    const { setCookie } = await loadTanStackStartServerModule();
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

  const establishSession = async (sessionToken: string) => {
    const { setCookie } = await loadTanStackStartServerModule();
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
    setCookie(cookieName, cookieToken, cookieOptions);
    return session;
  };

  const signOut = async () => {
    const { deleteCookie } = await loadTanStackStartServerModule();
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
    establishSession,
    signOut,
    requireSession,
    withSession,
  };
}

/**
 * Build a Request handler for `/api/auth/*` routes in TanStack Start.
 *
 * Supported endpoints:
 * - `GET /api/auth/session`
 * - `GET /api/auth/token`
 * - `POST /api/auth/sign-in-with-email`
 * - `POST /api/auth/sign-out`
 */
export function createTanStackStartAuthApiHandler(
  options: TanStackStartAuthApiHandlerOptions
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
            return await createOAuthErrorRedirectResponse({
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
          const callbackUrl = buildTanStackOAuthCallbackUrl(
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

          await setOAuthStateCookie(basePath, {
            state,
            providerId: providerSegment,
            redirectTo,
            errorRedirectTo,
          });

          if (requestUrl.searchParams.get("mode") === "json") {
            return jsonNoStore({
              authorizationUrl: startResult.authorizationUrl,
            });
          }

          return createRedirectResponse(request, startResult.authorizationUrl);
        }

        const stateCookie = parseOAuthStateCookie(request);
        const errorRedirectTarget =
          stateCookie?.errorRedirectTo ?? stateCookie?.redirectTo;
        const providerError = requestUrl.searchParams.get("error");
        if (providerError) {
          return await createOAuthErrorRedirectResponse({
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
          return await createOAuthErrorRedirectResponse({
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
          return await createOAuthErrorRedirectResponse({
            request,
            providerId: providerSegment,
            error: "oauth_callback_error",
            description: "Missing OAuth authorization code",
            target: errorRedirectTarget,
            clearStateCookie: true,
            basePath,
          });
        }

        const requestIp = resolveClientIp(request, options);
        const requestUserAgent = request.headers.get("user-agent") ?? undefined;
        try {
          const callbackResult = parseOAuthCallbackResult(
            await fetchAction(oauthActions.handleOAuthCallback, {
              providerId: providerSegment,
              code,
              state,
              callbackUrl: buildTanStackOAuthCallbackUrl(
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

          await options.tanstackAuth.establishSession(
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
          await clearOAuthStateCookie(basePath);
          return createRedirectResponse(
            request,
            normalizeRedirectTarget(request, redirectTarget)
          );
        } catch (error) {
          return await createOAuthErrorRedirectResponse({
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
        const session = await options.tanstackAuth.getSession();
        return json({ session });
      }

      if (request.method === "GET" && action === "token") {
        const token = await options.tanstackAuth.getToken();
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
 * Build Convex fetch helpers for TanStack Start server functions.
 * Authenticated helpers resolve auth from cookies via `requireSession`.
 */
export function createTanStackStartConvexFetchers(
  options: TanStackStartConvexFetchersOptions
): TanStackStartConvexFetchers {
  const sharedFetchers = createConvexFetchers<void>({
    convexUrl: options.convexUrl,
    resolveAuthToken: async () => {
      return (await options.tanstackAuth.requireSession()).token;
    },
  });

  return {
    fetchQuery: async (fn, args) => {
      return sharedFetchers.fetchQuery(fn, args);
    },
    fetchMutation: async (fn, args) => {
      return sharedFetchers.fetchMutation(fn, args);
    },
    fetchAction: async (fn, args) => {
      return sharedFetchers.fetchAction(fn, args);
    },
    fetchAuthQuery: async (fn, args) => {
      return sharedFetchers.fetchAuthQuery(undefined, fn, args);
    },
    fetchAuthMutation: async (fn, args) => {
      return sharedFetchers.fetchAuthMutation(undefined, fn, args);
    },
    fetchAuthAction: async (fn, args) => {
      return sharedFetchers.fetchAuthAction(undefined, fn, args);
    },
  };
}

/**
 * Build TanStack Start auth handlers directly from Convex public mutation refs.
 *
 * This removes transport boilerplate in app code while keeping session logic
 * fully based on Convex functions.
 */
function createTanStackStartConvexAuth(
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
      await convex.mutation(coreActions.invalidateSession, { token });
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
  const pluginMeta = resolvePluginMeta(options);
  const coreMeta = resolveCoreMeta(options);
  if (
    autoPluginsEnabled &&
    hasPluginFunctionRefs(options.convexFunctions) &&
    pluginMeta === undefined
  ) {
    throw new Error(
      'createTanStackAuthServer requires "pluginMeta" when plugins is "auto". ' +
        "Pass generated authMeta/authPluginMeta (convex/zen/_generated/meta.ts) " +
        'or disable auto plugins with plugins: [].'
    );
  }

  const tanstackAuth = createTanStackStartConvexAuth(options);
  const fetchers = createTanStackStartConvexFetchers({
    tanstackAuth,
    convexUrl: options.convexUrl,
  });
  const autoPluginFactories: TanStackStartAuthApiPluginFactory[] = [];
  autoPluginFactories.push(coreApiPlugin(coreMeta ? { coreMeta } : {}));
  if (hasPluginMeta(pluginMeta)) {
    autoPluginFactories.push(
      pluginApiPlugin({
        pluginMeta: pluginMeta as AuthPluginMeta,
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
    convexFunctions: options.convexFunctions as Record<string, unknown>,
    fetchers,
    ...(coreMeta !== undefined ? { coreMeta } : {}),
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
    establishSession: tanstackAuth.establishSession,
    signOut: tanstackAuth.signOut,
    requireSession: tanstackAuth.requireSession,
    withSession: tanstackAuth.withSession,
    fetchQuery: fetchers.fetchQuery,
    fetchMutation: fetchers.fetchMutation,
    fetchAction: fetchers.fetchAction,
    fetchAuthQuery: fetchers.fetchAuthQuery,
    fetchAuthMutation: fetchers.fetchAuthMutation,
    fetchAuthAction: fetchers.fetchAuthAction,
    handler,
  };
}

export * from "./client";
export * from "./client-plugins";
