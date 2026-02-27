import type {
  EmailProvider,
  ConvexAuthPlugin,
  OAuthProviderConfig,
  AdminPluginConfig,
  AdminListUsersResult,
} from "../types";
import { AdminPlugin } from "./plugins/admin";

/**
 * Minimal Convex context interfaces. Parameters use `any` so that Convex's
 * actual generic context types (which have typed FunctionReference params)
 * satisfy these interfaces without triggering contravariant type errors.
 */
interface RunsQueries {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  runQuery: (fn: any, args: any) => Promise<any>;
}
interface RunsMutations {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  runMutation: (fn: any, args: any) => Promise<any>;
}
interface RunsActions {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  runAction: (fn: any, args: any) => Promise<any>;
}
type ConvexCtx = RunsQueries & RunsMutations;
type PluginList = readonly ConvexAuthPlugin[];
type AdminPluginFor<TPlugins extends PluginList> =
  Extract<TPlugins[number], { id: "admin" }> extends never
    ? null
    : AdminPlugin;
type MaybePromise<T> = T | Promise<T>;
type AuthIdentity = {
  subject?: string | null;
  [key: string]: unknown;
};
type PasswordValidationContext = "signUp" | "resetPassword";
type PasswordValidationInput = {
  password: string;
  context: PasswordValidationContext;
};
type StandardSchemaIssue = {
  message: string;
  path?: readonly PropertyKey[];
};
type StandardSchemaResult<Output> =
  | { value: Output }
  | { issues: readonly StandardSchemaIssue[] };
export type StandardSchemaV1<Input = unknown, Output = Input> = {
  readonly "~standard": {
    readonly version: 1;
    readonly vendor: string;
    readonly validate: (
      value: unknown
    ) => MaybePromise<StandardSchemaResult<Output>>;
    readonly types?: {
      readonly input: Input;
      readonly output: Output;
    };
  };
};
type PasswordValidationFn = (
  input: PasswordValidationInput
) => MaybePromise<string | null | void>;
type PasswordSchema =
  | StandardSchemaV1<string, unknown>
  | StandardSchemaV1<PasswordValidationInput, unknown>;
type PasswordValidationConfig = PasswordValidationFn | PasswordSchema;

const DEFAULT_MIN_PASSWORD_LENGTH = 12;
const DEFAULT_MAX_PASSWORD_LENGTH = 128;

interface AdminFacade {
  isAdmin: (
    ctx: RunsQueries,
    args?: { actorUserId?: string }
  ) => Promise<boolean>;
  listUsers: (
    ctx: RunsQueries,
    args?: { actorUserId?: string; limit?: number; cursor?: string }
  ) => Promise<AdminListUsersResult>;
  banUser: (
    ctx: RunsMutations,
    args: {
      actorUserId?: string;
      userId: string;
      reason?: string;
      expiresAt?: number;
    }
  ) => Promise<void>;
  unbanUser: (
    ctx: RunsMutations,
    args: { actorUserId?: string; userId: string }
  ) => Promise<void>;
  setRole: (
    ctx: RunsMutations,
    args: { actorUserId?: string; userId: string; role: string }
  ) => Promise<void>;
  deleteUser: (
    ctx: RunsMutations,
    args: { actorUserId?: string; userId: string }
  ) => Promise<void>;
}
type AdminFacadeFor<TPlugins extends PluginList> =
  Extract<TPlugins[number], { id: "admin" }> extends never
    ? null
    : AdminFacade;

export interface AuthUser {
  _id: string;
  email: string;
  emailVerified: boolean;
  name?: string;
  image?: string;
  role?: string;
  banned?: boolean;
  banReason?: string;
  banExpires?: number;
  createdAt?: number;
  updatedAt?: number;
}

/** ConvexZen constructor options. */
export interface ConvexZenOptions<TPlugins extends PluginList = PluginList> {
  providers?: OAuthProviderConfig[];
  emailProvider?: EmailProvider;
  plugins?: TPlugins;
  /** Require email verification before sign-in. Default: true. */
  requireEmailVerified?: boolean;
  /**
   * Optional additive password validation.
   * Return a string to throw that message as an auth error.
   */
  validatePassword?: PasswordValidationConfig;
  /**
   * Secret used to encrypt sensitive persisted provider fields.
   * Defaults to process.env.CONVEX_ZEN_SECRET when available.
   */
  tokenEncryptionSecret?: string;
  tokenEncryptionSecretEnvVar?: string;
  /**
   * Optional global token resolver so callers can do auth APIs with only `ctx`.
   * Commonly reads from framework/identity context.
   */
  resolveSessionToken?: (ctx: unknown) => MaybePromise<string | null>;
  /**
   * Optional global userId resolver when using identity-based auth.
   * Defaults to `ctx.auth.getUserIdentity()?.subject` when available.
   */
  resolveUserId?: (ctx: unknown) => MaybePromise<string | null>;
}

/**
 * ConvexZen — the main integration class for convex-zen.
 *
 * Instantiate once in the host app with the component reference and config.
 * All auth operations go through this class.
 *
 * @example
 * ```ts
 * // convex/auth.ts
 * import { ConvexZen, googleProvider } from "convex-zen";
 * import { adminPlugin } from "convex-zen/plugins/admin";
 * import { components } from "./_generated/api";
 *
 * export const auth = new ConvexZen(components.convexAuth, {
 *   providers: [googleProvider({ clientId: "...", clientSecret: "..." })],
 *   emailProvider: {
 *     sendVerificationEmail: async (to, code) => { ... },
 *     sendPasswordResetEmail: async (to, code) => { ... },
 *   },
 *   plugins: [adminPlugin({ defaultRole: "user" })],
 * });
 * ```
 */
export class ConvexZen<TPlugins extends PluginList = PluginList> {
  private readonly component: Record<string, unknown>;
  private readonly options: ConvexZenOptions<TPlugins>;
  private readonly _adminPlugin: AdminPlugin | null;
  private readonly providerMap: Map<string, OAuthProviderConfig>;
  private readonly adminConfig: AdminPluginConfig | null;

  constructor(
    component: Record<string, unknown>,
    options: ConvexZenOptions<TPlugins> = {}
  ) {
    this.component = component;
    this.options = options;
    const tokenEncryptionSecret = this.resolveTokenEncryptionSecret();
    const normalizedProviders = (options.providers ?? []).map((provider) => {
      if (provider.tokenEncryptionSecret !== undefined) {
        return provider;
      }
      if (!tokenEncryptionSecret) {
        return provider;
      }
      return {
        ...provider,
        tokenEncryptionSecret,
      };
    });

    this.providerMap = new Map(
      normalizedProviders.map((p) => [p.id, p])
    );

    const rawAdminConfig =
      options.plugins?.find(
        (p): p is AdminPluginConfig => p.id === "admin"
      ) ?? null;
    this.adminConfig = rawAdminConfig
      ? {
          ...rawAdminConfig,
          defaultRole:
            rawAdminConfig.defaultRole?.trim() || "user",
          adminRole:
            rawAdminConfig.adminRole?.trim() || "admin",
        }
      : null;

    this._adminPlugin = this.adminConfig
      ? new AdminPlugin(component, this.adminConfig)
      : null;
  }

  /** Access plugin instances after initialization. */
  get plugins() {
    return {
      admin: this._adminPlugin as AdminPluginFor<TPlugins>,
    };
  }

  /** Alias for plugins to support auth.plugin.admin style access. */
  get plugin() {
    return this.plugins;
  }

  /** Admin facade on the auth object (no separate authSystem object required). */
  get admin(): AdminFacadeFor<TPlugins> {
    if (!this._adminPlugin) {
      return null as AdminFacadeFor<TPlugins>;
    }
    return {
      isAdmin: async (ctx, args = {}) => {
        const actorUserId =
          args.actorUserId ?? (await this.resolveUserId(ctx));
        if (!actorUserId) {
          return false;
        }
        return this._adminPlugin!.isAdmin(ctx, { actorUserId });
      },
      listUsers: async (ctx, args = {}) => {
        const actorUserId =
          args.actorUserId ?? (await this.requireAdminActorUserId(ctx));
        const payload: {
          actorUserId: string;
          limit?: number;
          cursor?: string;
        } = {
          actorUserId,
        };
        if (args.limit !== undefined) {
          payload.limit = args.limit;
        }
        if (args.cursor !== undefined) {
          payload.cursor = args.cursor;
        }
        return this._adminPlugin!.listUsers(ctx, payload);
      },
      banUser: async (ctx, args) => {
        const actorUserId =
          args.actorUserId ?? (await this.requireAdminActorUserId(ctx));
        const payload: {
          actorUserId: string;
          userId: string;
          reason?: string;
          expiresAt?: number;
        } = {
          actorUserId,
          userId: args.userId,
        };
        if (args.reason !== undefined) {
          payload.reason = args.reason;
        }
        if (args.expiresAt !== undefined) {
          payload.expiresAt = args.expiresAt;
        }
        return this._adminPlugin!.banUser(ctx, payload);
      },
      unbanUser: async (ctx, args) => {
        const actorUserId =
          args.actorUserId ?? (await this.requireAdminActorUserId(ctx));
        const payload: {
          actorUserId: string;
          userId: string;
        } = {
          actorUserId,
          userId: args.userId,
        };
        return this._adminPlugin!.unbanUser(ctx, payload);
      },
      setRole: async (ctx, args) => {
        const actorUserId =
          args.actorUserId ?? (await this.requireAdminActorUserId(ctx));
        const payload: {
          actorUserId: string;
          userId: string;
          role: string;
        } = {
          actorUserId,
          userId: args.userId,
          role: args.role,
        };
        return this._adminPlugin!.setRole(ctx, payload);
      },
      deleteUser: async (ctx, args) => {
        const actorUserId =
          args.actorUserId ?? (await this.requireAdminActorUserId(ctx));
        const payload: {
          actorUserId: string;
          userId: string;
        } = {
          actorUserId,
          userId: args.userId,
        };
        return this._adminPlugin!.deleteUser(ctx, payload);
      },
    } as AdminFacadeFor<TPlugins>;
  }

  /** Session helpers available directly on auth object. */
  get session() {
    return {
      validate: async (ctx: ConvexCtx, token?: string) => {
        return this.safeValidateSession(ctx, token);
      },
      require: async (ctx: ConvexCtx, token?: string) => {
        return this.requireAuthSession(ctx, token);
      },
    };
  }

  /** Authenticated user helpers available directly on auth object. */
  get user() {
    return {
      safeGet: async (ctx: ConvexCtx, token?: string) => {
        return this.safeGetAuthUser(ctx, token);
      },
      require: async (ctx: ConvexCtx, token?: string) => {
        return this.requireAuthUser(ctx, token);
      },
    };
  }

  /**
   * Register OAuth callback HTTP routes on the host's router.
   * Mounts GET `/auth/callback/:provider` for each configured OAuth provider.
   *
   * @example
   * ```ts
   * // convex/http.ts
   * import { httpRouter } from "convex/server";
   * import { auth } from "./auth";
   * const http = httpRouter();
   * auth.registerRoutes(http);
   * export default http;
   * ```
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registerRoutes(http: any, options?: { callbackBaseUrl?: string }): void {
    for (const provider of this.providerMap.values()) {
      const path = `/auth/callback/${provider.id}`;

      http.route({
        path,
        method: "GET",
        handler: async (req: Request) => {
          const url = new URL(req.url);
          const code = url.searchParams.get("code");
          const state = url.searchParams.get("state");
          const error = url.searchParams.get("error");

          if (error) {
            return new Response(JSON.stringify({ error }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }

          if (!code || !state) {
            return new Response(
              JSON.stringify({ error: "Missing code or state" }),
              { status: 400, headers: { "Content-Type": "application/json" } }
            );
          }

          // Note: HTTP handlers can't use ctx directly.
          // Host app should use a Convex HTTP action that calls auth.handleCallback.
          // This default handler returns the raw data for the host to process.
          return new Response(
            JSON.stringify({
              code,
              state,
              provider: provider.id,
              callbackUrl: options?.callbackBaseUrl
                ? `${options.callbackBaseUrl}${path}`
                : undefined,
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }
          );
        },
      });
    }
  }

  /**
   * Sign up a new user with email and password.
   * Generates a verification code and sends it via the configured emailProvider.
   * Call from a Convex mutation in the host app.
   */
  async signUp(
    ctx: ConvexCtx,
    args: {
      email: string;
      password: string;
      name?: string;
      ipAddress?: string;
    }
  ): Promise<{ status: "verification_required" }> {
    if (!this.options.emailProvider) {
      throw new Error("emailProvider is required for email/password auth");
    }
    await this.assertPasswordPolicy({
      password: args.password,
      context: "signUp",
    });

    const result = (await ctx.runMutation(
      this.fn("gateway:signUp"),
      {
        ...args,
        defaultRole: this.resolveDefaultRole(),
      }
    )) as { status: "verification_required"; verificationCode: string };

    // Send email from host app context (functions can't be Convex args)
    await this.options.emailProvider.sendVerificationEmail(
      args.email,
      result.verificationCode
    );

    return { status: "verification_required" };
  }

  /**
   * Sign in with email and password.
   * Call from a Convex mutation in the host app.
   */
  async signIn(
    ctx: ConvexCtx,
    args: {
      email: string;
      password: string;
      ipAddress?: string;
      userAgent?: string;
    }
  ): Promise<{ sessionToken: string; userId: string }> {
    return ctx.runMutation(this.fn("gateway:signIn"), {
      ...args,
      requireEmailVerified: this.options.requireEmailVerified ?? true,
    }) as Promise<{ sessionToken: string; userId: string }>;
  }

  /**
   * Verify email with a verification code.
   */
  async verifyEmail(
    ctx: ConvexCtx,
    args: { email: string; code: string }
  ): Promise<{ status: string }> {
    return ctx.runMutation(
      this.fn("gateway:verifyEmail"),
      args
    ) as Promise<{ status: string }>;
  }

  /**
   * Request a password reset. Sends the reset code via emailProvider.
   */
  async requestPasswordReset(
    ctx: ConvexCtx,
    args: { email: string; ipAddress?: string }
  ): Promise<{ status: "sent" }> {
    if (!this.options.emailProvider) {
      throw new Error("emailProvider is required for password reset");
    }

    const result = (await ctx.runMutation(
      this.fn("gateway:requestPasswordReset"),
      args
    )) as { status: "sent"; resetCode: string | null };

    if (result.resetCode) {
      await this.options.emailProvider.sendPasswordResetEmail(
        args.email,
        result.resetCode
      );
    }

    return { status: "sent" };
  }

  /**
   * Reset password using a verification code.
   */
  async resetPassword(
    ctx: ConvexCtx,
    args: { email: string; code: string; newPassword: string }
  ): Promise<{ status: string }> {
    await this.assertPasswordPolicy({
      password: args.newPassword,
      context: "resetPassword",
    });
    return ctx.runMutation(
      this.fn("gateway:resetPassword"),
      args
    ) as Promise<{ status: string }>;
  }

  /**
   * Get an OAuth authorization URL for the given provider.
   * Call from a Convex action.
   */
  async getOAuthUrl(
    ctx: RunsActions,
    providerId: string,
    redirectUrl?: string
  ): Promise<{ authorizationUrl: string }> {
    const provider = this.providerMap.get(providerId);
    if (!provider) {
      throw new Error(`OAuth provider "${providerId}" not configured`);
    }
    return ctx.runAction(this.fn("gateway:getAuthorizationUrl"), {
      provider,
      redirectUrl,
    }) as Promise<{ authorizationUrl: string }>;
  }

  /**
   * Handle an OAuth callback. Call from a Convex HTTP action.
   * Validates state, exchanges code for tokens, upserts user, creates session.
   */
  async handleCallback(
    ctx: RunsActions,
    args: {
      code: string;
      state: string;
      providerId: string;
      ipAddress?: string;
      userAgent?: string;
      redirectUrl?: string;
    }
  ): Promise<{ sessionToken: string; userId: string; redirectUrl?: string }> {
    const provider = this.providerMap.get(args.providerId);
    if (!provider) {
      throw new Error(`OAuth provider "${args.providerId}" not configured`);
    }
    return ctx.runAction(this.fn("gateway:handleCallback"), {
      provider,
      code: args.code,
      state: args.state,
      redirectUrl: args.redirectUrl,
      ipAddress: args.ipAddress,
      userAgent: args.userAgent,
      defaultRole: this.resolveDefaultRole(),
    }) as Promise<{
      sessionToken: string;
      userId: string;
      redirectUrl?: string;
    }>;
  }

  /**
   * Validate a session token. Returns user/session IDs or null.
   * Call from a mutation context.
   */
  async validateSession(
    ctx: ConvexCtx,
    token: string
  ): Promise<{ userId: string; sessionId: string } | null> {
    return ctx.runMutation(this.fn("gateway:validateSession"), {
      token,
      checkBanned: this.adminConfig !== null,
    }) as Promise<{ userId: string; sessionId: string } | null>;
  }

  /**
   * Validate session, resolving token from context when one is not provided.
   */
  async safeValidateSession(
    ctx: ConvexCtx,
    token?: string
  ): Promise<{ userId: string; sessionId: string } | null> {
    const resolvedToken = await this.resolveToken(ctx, token);
    if (!resolvedToken) {
      return null;
    }
    return this.validateSession(ctx, resolvedToken);
  }

  /**
   * Validate session and throw when missing/invalid.
   */
  async requireAuthSession(
    ctx: ConvexCtx,
    token?: string
  ): Promise<{ userId: string; sessionId: string }> {
    const session = await this.safeValidateSession(ctx, token);
    if (!session) {
      throw new Error("Unauthorized");
    }
    return session;
  }

  /**
   * Resolve the current signed-in user from a session token.
   * Returns null when token is invalid/expired/banned.
   */
  async getAuthUserFromToken(
    ctx: ConvexCtx,
    token: string
  ): Promise<AuthUser | null> {
    return ctx.runMutation(this.fn("gateway:getCurrentUser"), {
      token,
      checkBanned: this.adminConfig !== null,
    }) as Promise<AuthUser | null>;
  }

  /**
   * Resolve authenticated user from `ctx` if possible.
   * Resolution order:
   * 1. explicit token argument
   * 2. resolveSessionToken option
   * 3. identity claims (session token-like fields)
   * 4. resolveUserId option
   * 5. `ctx.auth.getUserIdentity()?.subject`
   */
  async safeGetAuthUser(
    ctx: ConvexCtx,
    token?: string
  ): Promise<AuthUser | null> {
    const resolvedToken = await this.resolveToken(ctx, token);
    if (resolvedToken) {
      return this.getAuthUserFromToken(ctx, resolvedToken);
    }

    const userId = await this.resolveUserId(ctx);
    if (!userId) {
      return null;
    }

    return ctx.runMutation(this.fn("gateway:getUserById"), {
      userId,
      checkBanned: this.adminConfig !== null,
    }) as Promise<AuthUser | null>;
  }

  /**
   * Resolve current user and throw if unauthenticated.
   */
  async requireAuthUser(
    ctx: ConvexCtx,
    token?: string
  ): Promise<AuthUser> {
    const user = await this.safeGetAuthUser(ctx, token);
    if (!user) {
      throw new Error("Unauthorized");
    }
    return user;
  }

  /**
   * Sign out by invalidating a session token.
   * Can be called from a mutation or action context.
   */
  async signOut(ctx: RunsMutations, token: string): Promise<void> {
    await ctx.runMutation(this.fn("gateway:invalidateSession"), { token });
  }

  /**
   * Sign out all sessions for a user.
   */
  async signOutAll(ctx: RunsMutations, userId: string): Promise<void> {
    await ctx.runMutation(this.fn("gateway:invalidateAllSessions"), { userId });
  }

  private resolveDefaultRole(): string | undefined {
    if (!this.adminConfig) {
      return undefined;
    }
    const role = this.adminConfig.defaultRole?.trim();
    return role && role.length > 0 ? role : "user";
  }

  private async assertPasswordPolicy(
    input: PasswordValidationInput
  ): Promise<void> {
    if (input.password.length < DEFAULT_MIN_PASSWORD_LENGTH) {
      throw new Error(
        `Password must be at least ${DEFAULT_MIN_PASSWORD_LENGTH} characters long`
      );
    }
    if (input.password.length > DEFAULT_MAX_PASSWORD_LENGTH) {
      throw new Error(
        `Password must be at most ${DEFAULT_MAX_PASSWORD_LENGTH} characters long`
      );
    }
    const customResult = await this.runCustomPasswordValidation(input);
    if (typeof customResult === "string" && customResult.length > 0) {
      throw new Error(customResult);
    }
  }

  private async runCustomPasswordValidation(
    input: PasswordValidationInput
  ): Promise<string | null | void> {
    const validator = this.options.validatePassword;
    if (!validator) {
      return;
    }
    if (this.isStandardSchema(validator)) {
      await this.assertPasswordStandardSchema(validator, input);
      return;
    }
    return await validator(input);
  }

  private isStandardSchema(
    value: PasswordValidationConfig
  ): value is PasswordSchema {
    return (
      typeof value === "object" &&
      value !== null &&
      "~standard" in value &&
      typeof value["~standard"] === "object" &&
      value["~standard"] !== null &&
      "validate" in value["~standard"] &&
      typeof value["~standard"].validate === "function"
    );
  }

  private getStandardSchemaIssues(
    result: StandardSchemaResult<unknown>
  ): readonly StandardSchemaIssue[] | null {
    return "issues" in result ? result.issues : null;
  }

  private async assertPasswordStandardSchema(
    schema: PasswordSchema,
    input: PasswordValidationInput
  ): Promise<void> {
    const stringResult = await schema["~standard"].validate(input.password);
    const stringIssues = this.getStandardSchemaIssues(stringResult);
    if (!stringIssues) {
      return;
    }

    const objectResult = await schema["~standard"].validate(input);
    const objectIssues = this.getStandardSchemaIssues(objectResult);
    if (!objectIssues) {
      return;
    }

    const issues = stringIssues.length > 0 ? stringIssues : objectIssues;
    const message = issues.find((issue) => issue.message.length > 0)?.message;
    throw new Error(message ?? "Password failed custom validation");
  }

  private resolveTokenEncryptionSecret(): string | undefined {
    const explicit = this.options.tokenEncryptionSecret?.trim();
    if (explicit && explicit.length > 0) {
      return explicit;
    }
    const envVar = this.options.tokenEncryptionSecretEnvVar ?? "CONVEX_ZEN_SECRET";
    const env = (
      globalThis as { process?: { env?: Record<string, string | undefined> } }
    ).process?.env;
    const fromEnv = env?.[envVar]?.trim();
    return fromEnv && fromEnv.length > 0 ? fromEnv : undefined;
  }

  private async getIdentity(ctx: unknown): Promise<AuthIdentity | null> {
    const auth = (ctx as { auth?: { getUserIdentity?: () => Promise<unknown> } })
      .auth;
    if (!auth?.getUserIdentity) {
      return null;
    }
    const identity = await auth.getUserIdentity();
    if (!identity || typeof identity !== "object") {
      return null;
    }
    return identity as AuthIdentity;
  }

  private getStringClaim(
    identity: AuthIdentity | null,
    claim: string
  ): string | null {
    if (!identity) {
      return null;
    }
    const value = identity[claim];
    return typeof value === "string" && value.length > 0 ? value : null;
  }

  private async resolveToken(
    ctx: unknown,
    explicitToken?: string
  ): Promise<string | null> {
    if (explicitToken) {
      return explicitToken;
    }

    const tokenFromResolver = await this.options.resolveSessionToken?.(ctx);
    if (tokenFromResolver) {
      return tokenFromResolver;
    }

    const identity = await this.getIdentity(ctx);
    return (
      this.getStringClaim(identity, "sessionToken") ??
      this.getStringClaim(identity, "token") ??
      this.getStringClaim(identity, "https://convex-zen.dev/sessionToken") ??
      null
    );
  }

  private async requireAdminActorUserId(ctx: unknown): Promise<string> {
    const userId = await this.resolveUserId(ctx);
    if (!userId) {
      throw new Error("Unauthorized: missing identity subject");
    }
    return userId;
  }

  private async resolveUserId(ctx: unknown): Promise<string | null> {
    const userIdFromResolver = await this.options.resolveUserId?.(ctx);
    if (userIdFromResolver) {
      return userIdFromResolver;
    }

    const identity = await this.getIdentity(ctx);
    if (!identity) {
      return null;
    }

    if (typeof identity.subject === "string" && identity.subject.length > 0) {
      return identity.subject;
    }
    return this.getStringClaim(identity, "userId");
  }

  /**
   * Resolve a component function reference by path string.
   * Converts "providers/emailPassword:signUp" into
   * component.providers.emailPassword.signUp via nested property traversal.
   */
  private fn(path: string): unknown {
    const [modulePath, funcName] = path.split(":");
    if (!modulePath || !funcName) {
      throw new Error(`Invalid function path: ${path}`);
    }
    const parts = modulePath.split("/");
    let ref: Record<string, unknown> = this.component;
    for (const part of parts) {
      const next = ref[part];
      if (
        !next ||
        typeof next !== "object" ||
        Array.isArray(next)
      ) {
        throw new Error(`Invalid function path segment: ${part}`);
      }
      ref = next as Record<string, unknown>;
    }
    const resolved = ref[funcName];
    if (!resolved) {
      throw new Error(`Function not found: ${path}`);
    }
    return resolved;
  }
}

// Named exports for convenience
export { googleProvider, githubProvider } from "./providers";
export { adminPlugin } from "./plugins/admin";
export {
  SessionPrimitives,
  createSessionPrimitives,
} from "./primitives";
export type {
  ConvexAuthPlugin,
  EmailProvider,
  OAuthProviderConfig,
  AdminPluginConfig,
} from "../types";
export type {
  SessionInfo,
  SignInInput,
  SignInOutput,
  SessionTransport,
  EstablishedSession,
} from "./primitives";
