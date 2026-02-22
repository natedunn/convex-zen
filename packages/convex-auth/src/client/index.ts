import type {
  EmailProvider,
  OAuthProviderConfig,
  AdminPluginConfig,
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
type ConvexCtx = RunsQueries & RunsMutations & RunsActions;


/** ConvexAuth constructor options. */
export interface ConvexAuthOptions {
  providers?: OAuthProviderConfig[];
  emailProvider?: EmailProvider;
  plugins?: AdminPluginConfig[];
  /** Require email verification before sign-in. Default: true. */
  requireEmailVerified?: boolean;
}

/**
 * ConvexAuth — the main integration class for convex-zen.
 *
 * Instantiate once in the host app with the component reference and config.
 * All auth operations go through this class.
 *
 * @example
 * ```ts
 * // convex/auth.ts
 * import { ConvexAuth, googleProvider } from "convex-zen";
 * import { adminPlugin } from "convex-zen/plugins/admin";
 * import { components } from "./_generated/api";
 *
 * export const auth = new ConvexAuth(components.convexAuth, {
 *   providers: [googleProvider({ clientId: "...", clientSecret: "..." })],
 *   emailProvider: {
 *     sendVerificationEmail: async (to, code) => { ... },
 *     sendPasswordResetEmail: async (to, code) => { ... },
 *   },
 *   plugins: [adminPlugin({ defaultRole: "user" })],
 * });
 * ```
 */
export class ConvexAuth {
  private readonly component: Record<string, unknown>;
  private readonly options: ConvexAuthOptions;
  private readonly _adminPlugin: AdminPlugin | null;
  private readonly providerMap: Map<string, OAuthProviderConfig>;
  private readonly adminConfig: AdminPluginConfig | null;

  constructor(
    component: Record<string, unknown>,
    options: ConvexAuthOptions = {}
  ) {
    this.component = component;
    this.options = options;

    this.providerMap = new Map(
      (options.providers ?? []).map((p) => [p.id, p])
    );

    this.adminConfig =
      options.plugins?.find(
        (p): p is AdminPluginConfig => p.id === "admin"
      ) ?? null;

    this._adminPlugin = this.adminConfig
      ? new AdminPlugin(component, this.adminConfig)
      : null;
  }

  /** Access plugin instances after initialization. */
  get plugins() {
    return {
      admin: this._adminPlugin,
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
   * Call from a Convex action in the host app.
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

    const result = (await ctx.runAction(
      this.fn("gateway:signUp"),
      args
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
   * Call from a Convex action in the host app.
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
    return ctx.runAction(this.fn("gateway:signIn"), {
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
    return ctx.runAction(
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

    const result = (await ctx.runAction(
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
    return ctx.runAction(
      this.fn("gateway:resetPassword"),
      args
    ) as Promise<{ status: string }>;
  }

  /**
   * Get an OAuth authorization URL for the given provider.
   * Call from a Convex action.
   */
  async getOAuthUrl(
    ctx: ConvexCtx,
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
    ctx: ConvexCtx,
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
    }) as Promise<{
      sessionToken: string;
      userId: string;
      redirectUrl?: string;
    }>;
  }

  /**
   * Validate a session token. Returns user/session IDs or null.
   * Can be called from queries, mutations, or actions.
   */
  async validateSession(
    ctx: ConvexCtx,
    token: string
  ): Promise<{ userId: string; sessionId: string } | null> {
    return ctx.runAction(this.fn("gateway:validateSession"), {
      token,
      checkBanned: this.adminConfig !== null,
    }) as Promise<{ userId: string; sessionId: string } | null>;
  }

  /**
   * Sign out by invalidating a session token.
   * Can be called from a mutation or action context.
   */
  async signOut(ctx: RunsActions, token: string): Promise<void> {
    await ctx.runAction(this.fn("gateway:invalidateSession"), { token });
  }

  /**
   * Sign out all sessions for a user.
   */
  async signOutAll(ctx: RunsActions, userId: string): Promise<void> {
    await ctx.runAction(this.fn("gateway:invalidateAllSessions"), { userId });
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
export type {
  EmailProvider,
  OAuthProviderConfig,
  AdminPluginConfig,
} from "../types";
