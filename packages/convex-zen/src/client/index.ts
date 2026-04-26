import type {
	EmailPasswordHandlers,
	ConvexAuthPlugin,
	PluginDefinition,
	PluginGatewayFunctionMetadata,
	PluginGatewayModule,
	PluginGatewayRuntimeMethods,
	PluginGatewayRuntimeMap,
	PluginSchemaDefinition,
	OAuthCallbackInput,
	OAuthCallbackResult,
	OAuthProviderConfig,
	OAuthStartOptions,
	OAuthStartResult,
} from "../types.js";
import { definePlugin, definePluginSchema } from "../types.js";
import type { HttpRouter } from "convex/server";
import { httpActionGeneric } from "convex/server";
import { resolveComponentFn } from "./helpers.js";
import {
	collectPluginGatewayMetadata,
	getPluginFunctionHandler,
} from "../component/plugin.js";

/**
 * Main client entrypoint.
 *
 * This file owns cross-plugin composition: it takes the app's `plugins` tuple
 * and decides which helpers `ConvexZen` should expose. Plugin-specific derived
 * types live with their plugin modules and are imported here.
 */

/**
 * Minimal Convex context interfaces used by the client wrappers.
 *
 * These are declared with method syntax so Convex's generated ctx types remain
 * structurally assignable under `strictFunctionTypes`.
 */
interface RunsQueries {
	runQuery(fn: unknown, args: Record<string, unknown>): Promise<unknown>;
}
interface RunsMutations {
	runMutation(fn: unknown, args: Record<string, unknown>): Promise<unknown>;
}
interface RunsActions {
	runAction(fn: unknown, args: Record<string, unknown>): Promise<unknown>;
}
type ConvexCtx = RunsQueries & RunsMutations;
type PluginList = readonly ConvexAuthPlugin[];
type PluginRuntimeMap<TPlugins extends PluginList> = {
	[TPlugin in TPlugins[number] as TPlugin["id"]]: TPlugin["definition"] extends PluginDefinition<
		any,
		any,
		infer TGateway,
		infer TRuntimeExtension
	>
		? PluginGatewayRuntimeMap<TGateway> & TRuntimeExtension
		: never;
};
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
			value: unknown,
		) => MaybePromise<StandardSchemaResult<Output>>;
		readonly types?: {
			readonly input: Input;
			readonly output: Output;
		};
	};
};
type PasswordValidationFn = (
	input: PasswordValidationInput,
) => MaybePromise<string | null | void>;
export type SuppressedEmailPasswordEvent =
	| {
			flow: "signUp";
			reason: "email_already_registered";
			email: string;
			ipAddress?: string;
	  }
	| {
			flow: "requestPasswordReset";
			reason: "email_not_found" | "rate_limited";
			email: string;
			ipAddress?: string;
	  };
type PasswordSchema =
	| StandardSchemaV1<string, unknown>
	| StandardSchemaV1<PasswordValidationInput, unknown>;
type PasswordValidationConfig = PasswordValidationFn | PasswordSchema;

export interface EmailPasswordConfig extends EmailPasswordHandlers {
	/** Require email verification before sign-in. Default: true. */
	requireVerification?: boolean;
	/**
	 * Optional additive password validation.
	 * Return a string to throw that message as an auth error.
	 */
	validatePassword?: PasswordValidationConfig;
	/**
	 * Optional backend-only hook for non-enumerating email/password outcomes.
	 * Use this for logging or observability without changing the generic UI
	 * response shown to end users.
	 */
	onSuppressedEvent?: (
		event: SuppressedEmailPasswordEvent,
	) => MaybePromise<void>;
}

export interface RuntimeConfig {
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

const DEFAULT_MIN_PASSWORD_LENGTH = 12;
const DEFAULT_MAX_PASSWORD_LENGTH = 128;

export interface AuthUser {
	_id: string;
	email: string;
	emailVerified: boolean;
	name?: string;
	image?: string;
	createdAt?: number;
	updatedAt?: number;
}

/** ConvexZen constructor options. */
export interface ConvexZenOptions<TPlugins extends PluginList = PluginList> {
	providers?: OAuthProviderConfig[];
	emailPassword?: EmailPasswordConfig;
	runtime?: RuntimeConfig;
	plugins?: TPlugins;
}

export type ConvexZenDefinition<TPlugins extends PluginList = PluginList> =
	ConvexZenOptions<TPlugins>;

type ComponentRuntimeRefs = {
	coreRefs?: {
		gateway?: Record<string, unknown>;
		removeUser?: unknown;
	};
};

function assertUniquePluginIds(plugins: PluginList): void {
	const ids = new Set<string>();
	for (const plugin of plugins) {
		if (ids.has(plugin.id)) {
			throw new Error(`Duplicate auth plugin id "${plugin.id}"`);
		}
		ids.add(plugin.id);
	}
}

export function defineConvexZen<TPlugins extends PluginList>(
	options: ConvexZenDefinition<TPlugins>,
): ConvexZenDefinition<TPlugins> {
	// `convex/zen.config.ts` should export this plain config object.
	// The CLI generator imports that file later and builds the runtime helpers.
	assertUniquePluginIds(options.plugins ?? []);
	return options;
}

export function createConvexZenClient<TPlugins extends PluginList>(
	component: Record<string, unknown>,
	definition: ConvexZenDefinition<TPlugins>,
	runtimeOptions?: { runtimeKind?: "app" | "component" } & ComponentRuntimeRefs,
): ConvexZen<TPlugins> {
	return new ConvexZen(
		component,
		definition,
		runtimeOptions?.runtimeKind ?? "app",
		{
			...(runtimeOptions?.coreRefs !== undefined
				? { coreRefs: runtimeOptions.coreRefs }
				: {}),
		},
	);
}

/**
 * ConvexZen — the main integration class for convex-zen.
 *
 * Instantiate once in the host app with the component reference and config.
 * In most apps this is created for you by generated runtime helpers.
 *
 * @example
 * ```ts
 * // convex/zen.runtime.ts
 * import { ConvexZen, googleProvider } from "convex-zen";
 * import { systemAdminPlugin } from "convex-zen/plugins/system-admin";
 * import { components } from "./_generated/api";
 *
 * export const auth = new ConvexZen(components.zenComponent, {
 *   providers: [googleProvider({ clientId: "...", clientSecret: "..." })],
 *   emailPassword: {
 *     sendVerification: async (to, code) => { ... },
 *     sendPasswordReset: async (to, code) => { ... },
 *     requireVerification: true,
 *   },
 *   runtime: {
 *     tokenEncryptionSecret: "...",
 *   },
 *   plugins: [systemAdminPlugin({ defaultRole: "user" })],
 * });
 * ```
 */
export class ConvexZen<TPlugins extends PluginList = PluginList> {
	private readonly component: Record<string, unknown>;
	private readonly options: ConvexZenOptions<TPlugins>;
	private readonly pluginRuntimes: PluginRuntimeMap<TPlugins>;
	private readonly providerMap: Map<string, OAuthProviderConfig>;
	private readonly runtimeKind: "app" | "component";
	private readonly componentRuntimeRefs: ComponentRuntimeRefs;

	constructor(
		component: Record<string, unknown>,
		options: ConvexZenOptions<TPlugins> = {},
		runtimeKind: "app" | "component" = "app",
		componentRuntimeRefs: ComponentRuntimeRefs = {},
	) {
		this.component = component;
		this.options = options;
		this.runtimeKind = runtimeKind;
		this.componentRuntimeRefs = componentRuntimeRefs;
		assertUniquePluginIds(options.plugins ?? []);
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

		this.providerMap = new Map(normalizedProviders.map((p) => [p.id, p]));
		this.pluginRuntimes = Object.fromEntries(
			(options.plugins ?? []).map((plugin) => [
				plugin.id,
				this.createPluginRuntime(plugin),
			]),
		) as PluginRuntimeMap<TPlugins>;
	}

	private createPluginRuntime<TPlugin extends ConvexAuthPlugin>(
		plugin: TPlugin,
	): PluginRuntimeMap<readonly [TPlugin]>[TPlugin["id"]] {
		const gateway = plugin.definition.gateway;
		const gatewayMetadata = collectPluginGatewayMetadata(gateway);
		const baseGateway = this.buildPluginGatewayRuntime<TPlugin["definition"]["gateway"]>(
			plugin.id,
			gateway,
			gatewayMetadata,
		);
		const extension =
			plugin.definition.extendRuntime?.({
				runtimeKind: this.runtimeKind,
				options: plugin.options,
				gateway: baseGateway,
				requireActorUserId: (ctx) => this.requireActorUserId(ctx),
				resolveUserId: (ctx) => this.resolveUserId(ctx),
				deleteAuthUser: (ctx, userId) => this.deleteAuthUser(ctx, userId),
			}) ?? {};
		for (const [key, value] of Object.entries(baseGateway)) {
			if (!(key in extension)) {
				Object.assign(extension, { [key]: value });
			}
		}
		return extension as PluginRuntimeMap<readonly [TPlugin]>[TPlugin["id"]];
	}

	private buildPluginGatewayRuntime<TGateway extends PluginGatewayModule>(
		pluginId: string,
		gateway: TGateway,
		gatewayMetadata: PluginGatewayRuntimeMethods,
	): PluginGatewayRuntimeMap<TGateway> {
		const runtime: Partial<PluginGatewayRuntimeMap<TGateway>> = {};
		for (const [rawFunctionName, metadata] of Object.entries(gatewayMetadata)) {
			const functionName =
				rawFunctionName as Extract<keyof PluginGatewayRuntimeMap<TGateway>, string>;
			runtime[functionName] = (async (ctx: unknown, args: Record<string, unknown>) =>
				await this.callPluginGatewayFunction(
					pluginId,
					gateway,
					rawFunctionName,
					metadata,
					ctx,
					args,
				)) as PluginGatewayRuntimeMap<TGateway>[typeof functionName];
		}
		return runtime as unknown as PluginGatewayRuntimeMap<TGateway>;
	}

	private async callPluginGatewayFunction(
		pluginId: string,
		gateway: PluginGatewayModule,
		functionName: string,
		metadata: PluginGatewayFunctionMetadata,
		ctx: unknown,
		args: Record<string, unknown>,
	): Promise<unknown> {
		if (this.runtimeKind === "component") {
			const invoke = (resolvedArgs: Record<string, unknown>) =>
				this.runComponentPluginFunction(
					pluginId,
					gateway,
					functionName,
					ctx,
					resolvedArgs,
				);
			if (metadata.auth === "public") {
				return await invoke(args);
			}
			const actorUserId =
				metadata.auth === "actor"
					? await this.requireActorUserId(ctx)
					: await this.resolveUserId(ctx);
			if (!actorUserId) {
				return false;
			}
			const actorEmail = metadata.actor?.actorEmail
				? await this.resolveActorEmail(ctx)
				: undefined;
			return await invoke({
				...args,
				actorUserId,
				...(actorEmail ? { actorEmail } : {}),
			});
		}

		const fn = resolveComponentFn(
			this.component,
			`plugins/${pluginId}/gateway:${functionName}`,
		);
		if (metadata.auth === "public") {
			return await this.runPluginFunction(ctx, metadata.kind, fn, args);
		}
		const actorUserId =
			metadata.auth === "actor"
				? await this.requireActorUserId(ctx)
				: await this.resolveUserId(ctx);
		if (!actorUserId) {
			return false;
		}
		const actorEmail = metadata.actor?.actorEmail
			? await this.resolveActorEmail(ctx)
			: undefined;
		return await this.runPluginFunction(ctx, metadata.kind, fn, {
			...args,
			actorUserId,
			...(actorEmail ? { actorEmail } : {}),
		});
	}

	private async runPluginFunction(
		ctx: unknown,
		kind: PluginGatewayFunctionMetadata["kind"],
		fn: unknown,
		args: Record<string, unknown>,
	): Promise<unknown> {
		if (kind === "query") {
			return await (ctx as RunsQueries).runQuery(fn, args);
		}
		if (kind === "mutation") {
			return await (ctx as RunsMutations).runMutation(fn, args);
		}
		return await (ctx as RunsActions).runAction(fn, args);
	}

	private async runComponentPluginFunction(
		pluginId: string,
		gateway: PluginGatewayModule,
		functionName: string,
		ctx: unknown,
		args: Record<string, unknown>,
	): Promise<unknown> {
		const exportValue = gateway[functionName];
		const handler = getPluginFunctionHandler(
			exportValue,
			`${pluginId}.${functionName}`,
		);
		return await handler(ctx, args);
	}

	async deleteAuthUser(ctx: unknown, userId: string): Promise<void> {
		for (const plugin of this.options.plugins ?? []) {
			const onUserDeleted = plugin.definition.hooks?.onUserDeleted;
			if (!onUserDeleted) {
				continue;
			}
			const runtime = this.pluginRuntimes[
				plugin.id as keyof PluginRuntimeMap<TPlugins>
			] as PluginRuntimeMap<TPlugins>[keyof PluginRuntimeMap<TPlugins>];
			await onUserDeleted({
				ctx,
				userId,
				options: plugin.options,
				runtime,
				callPluginMutation: async (functionName, args) => {
					if (this.runtimeKind === "component") {
						return await this.runComponentPluginFunction(
							plugin.id,
							plugin.definition.gateway,
							functionName,
							ctx,
							args,
						);
					}
					return await (ctx as RunsMutations).runMutation(
						resolveComponentFn(
							this.component,
							`plugins/${plugin.id}/gateway:${functionName}`,
						),
						args,
					);
				},
			});
		}
		const removeUserFn =
			this.runtimeKind === "component"
				? this.componentRuntimeRefs.coreRefs?.removeUser ??
					resolveComponentFn(this.component, "core/users:remove")
				: resolveComponentFn(this.component, "core/users:remove");
		await (ctx as RunsMutations).runMutation(removeUserFn, { userId });
	}

	private async resolveActorEmail(ctx: unknown): Promise<string | undefined> {
		const actor = await this.safeGetAuthUser(ctx as RunsQueries);
		return actor?.email;
	}

	/** Access plugin instances after initialization. */
	get plugins(): PluginRuntimeMap<TPlugins> {
		return this.pluginRuntimes;
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
			safeGet: async (ctx: RunsQueries, token?: string) => {
				return this.safeGetAuthUser(ctx, token);
			},
			require: async (ctx: RunsQueries, token?: string) => {
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
	 * import { auth } from "./zen.runtime";
	 * const http = httpRouter();
	 * auth.registerRoutes(http);
	 * export default http;
	 * ```
	 */
	registerRoutes(http: HttpRouter, options?: { callbackBaseUrl?: string }): void {
		for (const provider of this.providerMap.values()) {
			const path = `/auth/callback/${provider.id}`;

			http.route({
				path,
				method: "GET",
				handler: httpActionGeneric(async (_, req) => {
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
							{ status: 400, headers: { "Content-Type": "application/json" } },
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
						},
					);
				}),
			});
		}
	}

	/**
	 * Sign up a new user with email and password.
	 * Generates a verification code and sends it via the configured email handler.
	 * Call from a Convex mutation in the host app.
	 */
	async signUp(
		ctx: ConvexCtx,
		args: {
			email: string;
			password: string;
			name?: string;
			ipAddress?: string;
		},
	): Promise<{ status: "verification_required" }> {
		if (!this.options.emailPassword?.sendVerification) {
			throw new Error(
				"emailPassword.sendVerification is required for email/password sign-up",
			);
		}
		await this.assertPasswordPolicy({
			password: args.password,
			context: "signUp",
		});

		const result = (await ctx.runMutation(this.fn("core/gateway:signUp"), {
			...args,
			defaultRole: this.resolveDefaultRole(),
		})) as {
			status: "verification_required";
			verificationCode: string | null;
			suppressedReason: "email_already_registered" | null;
		};

		// Only send the verification email when a code was produced.
		// A null code means the address was already registered; we return the
		// same response shape to avoid revealing whether the email exists.
		if (result.verificationCode !== null) {
			await this.options.emailPassword.sendVerification(
				args.email,
				result.verificationCode,
			);
		} else if (result.suppressedReason !== null) {
			await this.options.emailPassword.onSuppressedEvent?.({
				flow: "signUp",
				reason: result.suppressedReason,
				email: args.email,
				...(args.ipAddress !== undefined ? { ipAddress: args.ipAddress } : {}),
			});
		}

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
		},
	): Promise<{ sessionToken: string; userId: string }> {
		return ctx.runMutation(this.fn("core/gateway:signIn"), {
			...args,
			requireVerification:
				this.options.emailPassword?.requireVerification ?? true,
			checkBanned: this.shouldCheckCreateSession(),
		}) as Promise<{ sessionToken: string; userId: string }>;
	}

	/**
	 * Verify email with a verification code.
	 */
	async verifyEmail(
		ctx: ConvexCtx,
		args: { email: string; code: string },
	): Promise<{ status: string }> {
		return ctx.runMutation(this.fn("core/gateway:verifyEmail"), args) as Promise<{
			status: string;
		}>;
	}

	/**
	 * Request a password reset. Sends the reset code via the configured email handler.
	 */
	async requestPasswordReset(
		ctx: ConvexCtx,
		args: { email: string; ipAddress?: string },
	): Promise<{ status: "sent" }> {
		if (!this.options.emailPassword?.sendPasswordReset) {
			throw new Error(
				"emailPassword.sendPasswordReset is required for password reset",
			);
		}

		const result = (await ctx.runMutation(
			this.fn("core/gateway:requestPasswordReset"),
			args,
		)) as {
			status: "sent";
			resetCode: string | null;
			suppressedReason: "email_not_found" | "rate_limited" | null;
		};

		if (result.resetCode) {
			await this.options.emailPassword.sendPasswordReset(
				args.email,
				result.resetCode,
			);
		} else if (result.suppressedReason !== null) {
			await this.options.emailPassword.onSuppressedEvent?.({
				flow: "requestPasswordReset",
				reason: result.suppressedReason,
				email: args.email,
				...(args.ipAddress !== undefined ? { ipAddress: args.ipAddress } : {}),
			});
		}

		return { status: "sent" };
	}

	/**
	 * Reset password using a verification code.
	 */
	async resetPassword(
		ctx: ConvexCtx,
		args: { email: string; code: string; newPassword: string },
	): Promise<{ status: "valid" }> {
		await this.assertPasswordPolicy({
			password: args.newPassword,
			context: "resetPassword",
		});
		const result = (await ctx.runMutation(
			this.fn("core/gateway:resetPassword"),
			args,
		)) as { status: "valid" | "invalid" | "expired" | "too_many_attempts" };

		if (result.status === "invalid") {
			throw new Error("Invalid password reset code");
		}

		if (result.status === "expired") {
			throw new Error("Password reset code has expired");
		}

		if (result.status === "too_many_attempts") {
			throw new Error("Too many invalid password reset attempts");
		}

		return { status: "valid" };
	}

	/**
	 * Get an OAuth authorization URL for the given provider.
	 * Call from a Convex mutation.
	 */
	async getOAuthUrl(
		ctx: RunsMutations,
		providerId: string,
		options?: string | OAuthStartOptions,
	): Promise<OAuthStartResult> {
		const provider = this.providerMap.get(providerId);
		if (!provider) {
			throw new Error(`OAuth provider "${providerId}" not configured`);
		}
		const resolvedOptions =
			typeof options === "string"
				? {
						callbackUrl: options,
						redirectUrl: options,
					}
				: options;
		return ctx.runMutation(this.fn("core/gateway:getAuthorizationUrl"), {
			provider,
			callbackUrl: resolvedOptions?.callbackUrl,
			redirectTo: resolvedOptions?.redirectTo,
			errorRedirectTo: resolvedOptions?.errorRedirectTo,
			redirectUrl: resolvedOptions?.redirectUrl,
		}) as Promise<OAuthStartResult>;
	}

	/**
	 * Handle an OAuth callback. Call from a Convex HTTP action.
	 * Validates state, exchanges code for tokens, upserts user, creates session.
	 */
	async handleCallback(
		ctx: RunsActions,
		args: OAuthCallbackInput,
	): Promise<OAuthCallbackResult> {
		const provider = this.providerMap.get(args.providerId);
		if (!provider) {
			throw new Error(`OAuth provider "${args.providerId}" not configured`);
		}
		return ctx.runAction(this.fn("core/gateway:handleCallback"), {
			provider,
			code: args.code,
			state: args.state,
			callbackUrl: args.callbackUrl,
			redirectTo: args.redirectTo,
			errorRedirectTo: args.errorRedirectTo,
			redirectUrl: args.redirectUrl,
			ipAddress: args.ipAddress,
			userAgent: args.userAgent,
			defaultRole: this.resolveDefaultRole(),
			checkBanned: this.shouldCheckCreateSession(),
		}) as Promise<OAuthCallbackResult>;
	}

	/**
	 * Validate a session token. Returns user/session IDs or null.
	 * Call from a mutation context.
	 */
	async validateSession(
		ctx: ConvexCtx,
		token: string,
	): Promise<{ userId: string; sessionId: string } | null> {
		return ctx.runMutation(this.fn("core/gateway:validateSession"), {
			token,
			checkBanned: this.shouldCheckResolvedSession(),
		}) as Promise<{ userId: string; sessionId: string } | null>;
	}

	/**
	 * Validate session, resolving token from context when one is not provided.
	 */
	async safeValidateSession(
		ctx: ConvexCtx,
		token?: string,
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
		token?: string,
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
		ctx: RunsQueries,
		token: string,
	): Promise<AuthUser | null> {
		return ctx.runQuery(this.fn("core/gateway:getCurrentUser"), {
			token,
			checkBanned: this.shouldCheckAuthUserRead(),
		}) as Promise<AuthUser | null>;
	}

	/**
	 * Resolve a user directly by id.
	 * Returns null when the user does not exist or is denied by plugin checks.
	 */
	async getAuthUserById(
		ctx: RunsQueries,
		userId: string,
	): Promise<AuthUser | null> {
		return ctx.runQuery(this.fn("core/gateway:getUserById"), {
			userId,
			checkBanned: this.shouldCheckAuthUserRead(),
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
		ctx: RunsQueries,
		token?: string,
	): Promise<AuthUser | null> {
		const resolvedToken = await this.resolveToken(ctx, token);
		if (resolvedToken) {
			return this.getAuthUserFromToken(ctx, resolvedToken);
		}

		const userId = await this.resolveUserId(ctx);
		if (!userId) {
			return null;
		}

		return ctx.runQuery(this.fn("core/gateway:getUserById"), {
			userId,
			checkBanned: this.shouldCheckAuthUserRead(),
		}) as Promise<AuthUser | null>;
	}

	/**
	 * Resolve current user and throw if unauthenticated.
	 */
	async requireAuthUser(ctx: RunsQueries, token?: string): Promise<AuthUser> {
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
		await ctx.runMutation(this.fn("core/gateway:invalidateSession"), { token });
	}

	/**
	 * Sign out all sessions for a user.
	 */
	async signOutAll(ctx: RunsMutations, userId: string): Promise<void> {
		await ctx.runMutation(this.fn("core/gateway:invalidateAllSessions"), { userId });
	}

	private resolveDefaultRole(): string | undefined {
		for (const plugin of this.options.plugins ?? []) {
			const role = plugin.definition.hooks?.onUserCreated?.defaultRole?.(
				plugin.options,
			);
			if (role !== undefined) {
				const trimmed = role.trim();
				return trimmed.length > 0 ? trimmed : undefined;
			}
		}
		return undefined;
	}

	private shouldCheckResolvedSession(): boolean {
		return (this.options.plugins ?? []).some(
			(plugin) => plugin.definition.hooks?.assertCanResolveSession === true,
		);
	}

	private shouldCheckCreateSession(): boolean {
		return (this.options.plugins ?? []).some(
			(plugin) => plugin.definition.hooks?.assertCanCreateSession === true,
		);
	}

	private shouldCheckAuthUserRead(): boolean {
		return (this.options.plugins ?? []).some(
			(plugin) => plugin.definition.hooks?.assertCanReadAuthUser === true,
		);
	}

	private async assertPasswordPolicy(
		input: PasswordValidationInput,
	): Promise<void> {
		if (input.password.length < DEFAULT_MIN_PASSWORD_LENGTH) {
			throw new Error(
				`Password must be at least ${DEFAULT_MIN_PASSWORD_LENGTH} characters long`,
			);
		}
		if (input.password.length > DEFAULT_MAX_PASSWORD_LENGTH) {
			throw new Error(
				`Password must be at most ${DEFAULT_MAX_PASSWORD_LENGTH} characters long`,
			);
		}
		const customResult = await this.runCustomPasswordValidation(input);
		if (typeof customResult === "string" && customResult.length > 0) {
			throw new Error(customResult);
		}
	}

	private async runCustomPasswordValidation(
		input: PasswordValidationInput,
	): Promise<string | null | void> {
		const validator = this.options.emailPassword?.validatePassword;
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
		value: PasswordValidationConfig,
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
		result: StandardSchemaResult<unknown>,
	): readonly StandardSchemaIssue[] | null {
		return "issues" in result ? result.issues : null;
	}

	private async assertPasswordStandardSchema(
		schema: PasswordSchema,
		input: PasswordValidationInput,
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
		const explicit = this.options.runtime?.tokenEncryptionSecret?.trim();
		if (explicit && explicit.length > 0) {
			return explicit;
		}
		const envVar =
			this.options.runtime?.tokenEncryptionSecretEnvVar ?? "CONVEX_ZEN_SECRET";
		const env = (
			globalThis as { process?: { env?: Record<string, string | undefined> } }
		).process?.env;
		const fromEnv = env?.[envVar]?.trim();
		return fromEnv && fromEnv.length > 0 ? fromEnv : undefined;
	}

	private async getIdentity(ctx: unknown): Promise<AuthIdentity | null> {
		const auth = (
			ctx as { auth?: { getUserIdentity?: () => Promise<unknown> } }
		).auth;
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
		claim: string,
	): string | null {
		if (!identity) {
			return null;
		}
		const value = identity[claim];
		return typeof value === "string" && value.length > 0 ? value : null;
	}

	private async resolveToken(
		ctx: unknown,
		explicitToken?: string,
	): Promise<string | null> {
		if (explicitToken) {
			return explicitToken;
		}

		const tokenFromResolver = await this.options.runtime?.resolveSessionToken?.(
			ctx,
		);

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

	private async requireActorUserId(ctx: unknown): Promise<string> {
		const userId = await this.resolveUserId(ctx);
		if (!userId) {
			throw new Error("Unauthorized: missing identity subject");
		}
		return userId;
	}

	private async resolveUserId(ctx: unknown): Promise<string | null> {
		const userIdFromResolver = await this.options.runtime?.resolveUserId?.(ctx);
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
		if (this.runtimeKind === "component") {
			const [, functionName] = path.split(":");
			if (!functionName) {
				throw new Error(`Invalid core function path: ${path}`);
			}
			const gatewayRefs = this.componentRuntimeRefs.coreRefs?.gateway;
			const fn = gatewayRefs?.[functionName];
			if (!fn) {
				throw new Error(
					`Missing component runtime core gateway reference for "${functionName}".`,
				);
			}
			return fn;
		}
		return resolveComponentFn(this.component, path);
	}

}

// Named exports for convenience
export { definePlugin, definePluginSchema };
export {
	buildOAuthAuthorizationUrl,
	discordProvider,
	defineOAuthProvider,
	exchangeOAuthAuthorizationCode,
	githubProvider,
	googleProvider,
	requireOAuthVerifiedEmail,
} from "./providers.js";
export { SessionPrimitives, createSessionPrimitives } from "./primitives.js";
export {
	createExpoAuthClient,
	createKeyValueStorageAuthStorage,
	createMemoryAuthStorage,
	DEFAULT_EXPO_CORE_META,
} from "./expo.js";
export { createRouteAuthRuntimeAdapter } from "./framework-adapter.js";
// Next.js runtime helpers stay on the dedicated "convex-zen/next" entrypoint
// so non-Next consumers do not pull Next-only modules into their bundles.
export type {
	AuthPluginFactory,
	AuthPluginFunctionAuth,
	AuthPluginFunctionKind,
	AuthPluginHooks,
	BuiltInOAuthProviderId,
	BuildOAuthAuthorizationUrlArgs,
	ConvexAuthPlugin,
	DiscordProviderOptions,
	ExchangeOAuthAuthorizationCodeArgs,
	GithubProviderOptions,
	GoogleProviderOptions,
	OAuthProfile,
	OAuthProviderDefinition,
	OAuthCallbackInput,
	OAuthCallbackResult,
	OAuthProviderConfig,
	OAuthProviderId,
	OAuthProviderRuntime,
	OAuthStartOptions,
	OAuthStartResult,
	OAuthTokenResponse,
	PluginDefinition,
	PluginGatewayFunctionMetadata,
	PluginGatewayModule,
	PluginGatewayRuntimeMap,
	PluginSchemaDefinition,
	PluginRuntimeExtensionContext,
	SystemAdminPluginConfig,
	SystemAdminListUsersResult,
	SystemAdminPluginOptions,
	Organization,
	OrganizationAvailablePermissionsResult,
	OrganizationDomain,
	OrganizationDomainVerificationChallenge,
	OrganizationIncomingInvitation,
	OrganizationInvitation,
	OrganizationInviteResult,
	OrganizationListItem,
	OrganizationListResult,
	OrganizationMember,
	OrganizationMemberUser,
	OrganizationMembership,
	BuiltInOrganizationAccessControl,
	OrganizationAccessControl,
	OrganizationCustomAccessControl,
	OrganizationCustomRoleDefinitions,
	OrganizationPermission,
	OrganizationPluginConfig,
	OrganizationPluginOptions,
	OrganizationRole,
	OrganizationRoleAssignmentInput,
	OrganizationRoleDefinition,
	OrganizationRoleDefinitions,
	OrganizationRoleListResult,
	OrganizationRoleName,
	OrganizationRoleRecord,
	OrganizationSlugCheckResult,
} from "../types.js";
export type {
	RouteAuthClientTokenSyncOptions,
	RouteAuthResolveRequestUrlContext,
	RouteAuthRoutePaths,
	RouteAuthRuntimeAdapterClient,
	RouteAuthRuntimeAdapterOptions,
	RouteAuthRuntimeClientOptions,
} from "./framework-adapter.js";
export type {
	AuthKeyValueStorage,
	ExpoAuthClientBase,
	AuthRuntimeStorage,
	AuthRuntimeSync,
	ConvexAuthClientLike,
	ExpoAuthClient,
	ExpoAuthClientOptions,
	ExpoAuthCoreMeta,
	ExpoAuthFunctionKind,
	ExpoAuthMeta,
	ExpoAuthPluginMeta,
	ExpoAuthRuntimeClientOptions,
	ExpoConvexActions,
	ExpoConvexFunctionRefs,
	ExpoOAuthActions,
	ExpoOAuthCallbackInput,
	ExpoOAuthResult,
	ExpoOAuthSignInOptions,
	KeyValueAuthStorageOptions,
} from "./expo.js";
export type {
	AuthenticatedSession,
	NextAuthApiHandlerOptions,
	NextAuthApiPlugin,
	NextAuthApiPluginFactory,
	NextAuthApiPluginFactoryContext,
	NextAuthApiPluginSelection,
	NextAuthApiPluginContext,
	NextAuthClientOptions,
	NextAuthCoreMeta,
	NextAuthFunctionKind,
	NextAuthMeta,
	NextAuthPluginMeta,
	NextAuthServer,
	NextAuthServerFns,
	NextAuthServerOptions,
	NextClientIpResolver,
	NextConvexActionRefs,
	NextConvexActions,
	NextConvexFetchers,
	NextConvexFetchersOptions,
	NextConvexAuthOptions,
	NextConvexAuthServer,
	NextConvexAuthServerFactory,
	NextConvexAuthServerFactoryOptions,
	NextConvexAuthServerOptions,
	NextCookieOptions,
	NextCookieSameSite,
	NextRequestFromHeadersOptions,
	NextResolveClientIpContext,
	NextServerAuth,
	NextServerGetSession,
	NextServerGetToken,
	NextServerAuthOptions,
	NextSignInResult,
	NextSignOutResult,
	NextTrustedOriginsConfig,
	NextTrustedOriginsFromEnvOptions,
	NextTrustedProxyConfig,
} from "./next/index.js";
export type {
	SessionInfo,
	SignInInput,
	SignInOutput,
	SessionTransport,
	EstablishedSession,
} from "./primitives.js";
