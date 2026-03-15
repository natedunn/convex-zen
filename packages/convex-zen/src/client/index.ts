import type {
	EmailProvider,
	ConvexAuthPlugin,
	OAuthCallbackInput,
	OAuthCallbackResult,
	OAuthProviderConfig,
	OAuthStartOptions,
	OAuthStartResult,
	AdminPluginConfig,
	Organization,
	OrganizationDomain,
	OrganizationDomainVerificationChallenge,
	OrganizationIncomingInvitation,
	OrganizationInvitation,
	OrganizationInviteResult,
	OrganizationAvailablePermissionsResult,
	OrganizationListResult,
	OrganizationMember,
	OrganizationMembership,
	BuiltInOrganizationAccessControl,
	OrganizationAccessControl,
	OrganizationCustomRoleDefinitions,
	OrganizationPermission,
	OrganizationPluginConfig,
	OrganizationRoleAssignmentInput,
	OrganizationRoleListResult,
	OrganizationRoleRecord,
	OrganizationRoleName,
	OrganizationSlugCheckResult,
} from "../types";
import type { HttpRouter } from "convex/server";
import { httpActionGeneric } from "convex/server";
import { AdminPlugin } from "./plugins/admin";
import { OrganizationPlugin } from "./plugins/organization";

/**
 * Minimal Convex context interfaces. Using `unknown` for the function
 * reference parameter lets any Convex ctx satisfy these interfaces while
 * remaining type-safe — the same pattern used throughout the plugin classes.
 */
interface RunsQueries {
	runQuery: (fn: unknown, args: Record<string, unknown>) => Promise<unknown>;
}
interface RunsMutations {
	runMutation: (fn: unknown, args: Record<string, unknown>) => Promise<unknown>;
}
interface RunsActions {
	runAction: (fn: unknown, args: Record<string, unknown>) => Promise<unknown>;
}
type ConvexCtx = RunsQueries & RunsMutations;
type PluginList = readonly ConvexAuthPlugin[];
type AdminPluginFor<TPlugins extends PluginList> =
	Extract<TPlugins[number], { id: "admin" }> extends never ? null : AdminPlugin;
type OrganizationPluginConfigFor<TPlugins extends PluginList> = Extract<
	TPlugins[number],
	OrganizationPluginConfig<any, any>
>;
type OrganizationAccessControlFor<
	TPlugins extends PluginList,
> = OrganizationPluginConfigFor<TPlugins> extends OrganizationPluginConfig<
	infer TCustomAccessControl,
	any
>
	? OrganizationAccessControl<TCustomAccessControl>
	: BuiltInOrganizationAccessControl;
type OrganizationCustomRolesFor<
	TPlugins extends PluginList,
> = OrganizationPluginConfigFor<TPlugins> extends OrganizationPluginConfig<
	any,
	infer TCustomRoles
>
	? TCustomRoles
	: {};
type OrganizationRoleFor<TPlugins extends PluginList> = OrganizationRoleName<
	OrganizationCustomRolesFor<TPlugins>
>;
type OrganizationPermissionFor<
	TPlugins extends PluginList,
> = OrganizationPermission<OrganizationAccessControlFor<TPlugins>>;
type OrganizationPluginFor<TPlugins extends PluginList> =
	OrganizationPluginConfigFor<TPlugins> extends never
		? null
		: OrganizationPlugin<
				OrganizationPluginConfigFor<TPlugins> extends OrganizationPluginConfig<
					infer TCustomAccessControl,
					any
				>
					? TCustomAccessControl
					: {},
				OrganizationPluginConfigFor<TPlugins> extends OrganizationPluginConfig<
					any,
					infer TCustomRoles
				>
					? TCustomRoles
					: OrganizationCustomRoleDefinitions<
							OrganizationAccessControlFor<TPlugins>
					  >
		  >;
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
type PasswordSchema =
	| StandardSchemaV1<string, unknown>
	| StandardSchemaV1<PasswordValidationInput, unknown>;
type PasswordValidationConfig = PasswordValidationFn | PasswordSchema;

const DEFAULT_MIN_PASSWORD_LENGTH = 12;
const DEFAULT_MAX_PASSWORD_LENGTH = 128;

interface OrganizationRoleInput<TRole extends string> {
	role?: TRole;
	roles?: readonly TRole[];
}

interface OrganizationFacade<
	TOrganizationRole extends string,
	TOrganizationPermission,
> {
	checkSlug: (
		ctx: RunsQueries,
		args: { slug: string },
	) => Promise<OrganizationSlugCheckResult>;
	createOrganization: (
		ctx: RunsMutations,
		args: { actorUserId?: string; name: string; slug: string; logo?: string },
	) => Promise<{ organization: Organization; membership: OrganizationMembership }>;
	updateOrganization: (
		ctx: RunsMutations,
		args: {
			actorUserId?: string;
			organizationId: string;
			name?: string;
			slug?: string;
			logo?: string;
		},
	) => Promise<Organization>;
	deleteOrganization: (
		ctx: RunsMutations,
		args: { actorUserId?: string; organizationId: string },
	) => Promise<void>;
	listOrganizations: (
		ctx: RunsQueries,
		args?: { actorUserId?: string },
	) => Promise<OrganizationListResult>;
	getOrganization: (
		ctx: RunsQueries,
		args: { actorUserId?: string; organizationId: string },
	) => Promise<Organization | null>;
	getMembership: (
		ctx: RunsQueries,
		args: { actorUserId?: string; organizationId: string },
	) => Promise<OrganizationMembership | null>;
	listMembers: (
		ctx: RunsQueries,
		args: { actorUserId?: string; organizationId: string },
	) => Promise<OrganizationMember[]>;
	inviteMember: (
		ctx: RunsMutations,
		args: {
			actorUserId?: string;
			organizationId: string;
			email: string;
			role: OrganizationRoleAssignmentInput;
		},
	) => Promise<OrganizationInviteResult>;
	listInvitations: (
		ctx: RunsQueries,
		args: { actorUserId?: string; organizationId: string },
	) => Promise<OrganizationInvitation[]>;
	listIncomingInvitations: (
		ctx: RunsQueries,
		args?: { actorUserId?: string },
	) => Promise<OrganizationIncomingInvitation[]>;
		acceptInvitation: (
			ctx: RunsMutations,
			args: { actorUserId?: string; token: string },
		) => Promise<OrganizationInvitation>;
		acceptIncomingInvitation: (
			ctx: RunsMutations,
			args: { actorUserId?: string; invitationId: string },
		) => Promise<OrganizationInvitation>;
		cancelInvitation: (
			ctx: RunsMutations,
			args: { actorUserId?: string; invitationId: string },
		) => Promise<OrganizationInvitation>;
		declineIncomingInvitation: (
			ctx: RunsMutations,
			args: { actorUserId?: string; invitationId: string },
		) => Promise<OrganizationInvitation>;
		removeMember: (
			ctx: RunsMutations,
			args: { actorUserId?: string; organizationId: string; userId: string },
	) => Promise<void>;
	setMemberRole: (
		ctx: RunsMutations,
		args: {
			actorUserId?: string;
			organizationId: string;
			userId: string;
			role: OrganizationRoleAssignmentInput;
		},
	) => Promise<OrganizationMembership>;
	createRole: (
		ctx: RunsMutations,
		args: {
			actorUserId?: string;
			organizationId: string;
			name: string;
			slug: string;
			description?: string;
			permissions: string[];
		},
	) => Promise<OrganizationRoleRecord>;
	listRoles: (
		ctx: RunsQueries,
		args: { actorUserId?: string; organizationId: string },
	) => Promise<OrganizationRoleListResult>;
	listAvailablePermissions: (
		ctx: RunsQueries,
		args: { actorUserId?: string; organizationId: string },
	) => Promise<OrganizationAvailablePermissionsResult>;
	getRole: (
		ctx: RunsQueries,
		args: { actorUserId?: string; roleId: string },
	) => Promise<OrganizationRoleRecord | null>;
	updateRole: (
		ctx: RunsMutations,
		args: {
			actorUserId?: string;
			roleId: string;
			name?: string;
			slug?: string;
			description?: string;
			permissions?: string[];
		},
	) => Promise<OrganizationRoleRecord>;
	deleteRole: (
		ctx: RunsMutations,
		args: { actorUserId?: string; roleId: string },
	) => Promise<void>;
	transferOwnership: (
		ctx: RunsMutations,
		args: {
			actorUserId?: string;
			organizationId: string;
			newOwnerUserId: string;
		},
	) => Promise<void>;
	addDomain: (
		ctx: RunsMutations,
		args: { actorUserId?: string; organizationId: string; hostname: string },
	) => Promise<OrganizationDomain>;
	listDomains: (
		ctx: RunsQueries,
		args: { actorUserId?: string; organizationId: string },
	) => Promise<OrganizationDomain[]>;
	getDomainVerificationChallenge: (
		ctx: RunsQueries,
		args: { actorUserId?: string; domainId: string },
	) => Promise<OrganizationDomainVerificationChallenge>;
	markDomainVerified: (
		ctx: RunsMutations,
		args: { actorUserId?: string; domainId: string },
	) => Promise<OrganizationDomain>;
	removeDomain: (
		ctx: RunsMutations,
		args: { actorUserId?: string; domainId: string },
	) => Promise<void>;
	resolveOrganizationByHost: (
		ctx: RunsQueries,
		args: { host: string },
	) => Promise<Organization | null>;
	hasRole: (
		ctx: RunsQueries,
		args: { actorUserId?: string; organizationId: string } & OrganizationRoleInput<TOrganizationRole>,
	) => Promise<boolean>;
	requireRole: (
		ctx: RunsQueries,
		args: { actorUserId?: string; organizationId: string } & OrganizationRoleInput<TOrganizationRole>,
	) => Promise<OrganizationMembership>;
	hasPermission: (
		ctx: RunsQueries,
		args: {
			actorUserId?: string;
			organizationId: string;
			permission: TOrganizationPermission;
		},
	) => Promise<boolean>;
	requirePermission: (
		ctx: RunsQueries,
		args: {
			actorUserId?: string;
			organizationId: string;
			permission: TOrganizationPermission;
		},
	) => Promise<OrganizationMembership>;
}

type OrganizationFacadeFor<TPlugins extends PluginList> =
	OrganizationPluginConfigFor<TPlugins> extends never
		? null
		: OrganizationFacade<
				OrganizationRoleFor<TPlugins>,
				OrganizationPermissionFor<TPlugins>
		  >;

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
	private readonly _organizationPlugin: OrganizationPluginFor<TPlugins>;
	private readonly providerMap: Map<string, OAuthProviderConfig>;
	private readonly adminConfig: AdminPluginConfig | null;
	private readonly organizationConfig: OrganizationPluginConfigFor<TPlugins> | null;

	constructor(
		component: Record<string, unknown>,
		options: ConvexZenOptions<TPlugins> = {},
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

		this.providerMap = new Map(normalizedProviders.map((p) => [p.id, p]));

		const rawAdminConfig =
			options.plugins?.find((p): p is AdminPluginConfig => p.id === "admin") ??
			null;
		this.adminConfig = rawAdminConfig
			? {
					...rawAdminConfig,
					defaultRole: rawAdminConfig.defaultRole?.trim() || "user",
					adminRole: rawAdminConfig.adminRole?.trim() || "admin",
				}
			: null;
		const rawOrganizationConfig =
			options.plugins?.find(
				(
					p,
				): p is OrganizationPluginConfigFor<TPlugins> => p.id === "organization",
			) ?? null;
		this.organizationConfig = rawOrganizationConfig
			? {
					...rawOrganizationConfig,
					allowUserOrganizationCreation:
						rawOrganizationConfig.allowUserOrganizationCreation !== false,
					inviteExpiresInMs:
						rawOrganizationConfig.inviteExpiresInMs ?? 7 * 24 * 60 * 60 * 1000,
					...(rawOrganizationConfig.subdomainSuffix?.trim()
						? { subdomainSuffix: rawOrganizationConfig.subdomainSuffix.trim() }
						: {}),
				} as OrganizationPluginConfigFor<TPlugins>
			: null;

		this._adminPlugin = this.adminConfig
			? new AdminPlugin(component, this.adminConfig)
			: null;
		this._organizationPlugin = this.organizationConfig
			? (new OrganizationPlugin(component, this.organizationConfig) as OrganizationPluginFor<TPlugins>)
			: null as OrganizationPluginFor<TPlugins>;
	}

	/** Access plugin instances after initialization. */
	get plugins() {
		return {
			admin: this._adminPlugin as AdminPluginFor<TPlugins>,
			organization: this._organizationPlugin as OrganizationPluginFor<TPlugins>,
		};
	}

	/** Alias for plugins to support auth.plugin.admin style access. */
	get plugin() {
		return this.plugins;
	}

	get organization(): OrganizationFacadeFor<TPlugins> {
		if (!this._organizationPlugin) {
			return null as OrganizationFacadeFor<TPlugins>;
		}
		return {
			checkSlug: async (ctx, args) => {
				return this._organizationPlugin!.checkSlug(ctx, args);
			},
			createOrganization: async (ctx, args) => {
				const actorUserId =
					args.actorUserId ?? (await this.requireActorUserId(ctx));
				const payload: {
					actorUserId: string;
					name: string;
					slug: string;
					logo?: string;
				} = {
					actorUserId,
					name: args.name,
					slug: args.slug,
				};
				if (args.logo !== undefined) {
					payload.logo = args.logo;
				}
				return this._organizationPlugin!.createOrganization(ctx, payload);
			},
			updateOrganization: async (ctx, args) => {
				const actorUserId =
					args.actorUserId ?? (await this.requireActorUserId(ctx));
				const payload: {
					actorUserId: string;
					organizationId: string;
					name?: string;
					slug?: string;
					logo?: string;
				} = {
					actorUserId,
					organizationId: args.organizationId,
				};
				if (args.name !== undefined) {
					payload.name = args.name;
				}
				if (args.slug !== undefined) {
					payload.slug = args.slug;
				}
				if (args.logo !== undefined) {
					payload.logo = args.logo;
				}
				return this._organizationPlugin!.updateOrganization(ctx, payload);
			},
			deleteOrganization: async (ctx, args) => {
				const actorUserId =
					args.actorUserId ?? (await this.requireActorUserId(ctx));
				return this._organizationPlugin!.deleteOrganization(ctx, {
					actorUserId,
					organizationId: args.organizationId,
				});
			},
			listOrganizations: async (ctx, args = {}) => {
				const actorUserId =
					args.actorUserId ?? (await this.requireActorUserId(ctx));
				return this._organizationPlugin!.listOrganizations(ctx, {
					actorUserId,
				});
			},
			getOrganization: async (ctx, args) => {
				const actorUserId =
					args.actorUserId ?? (await this.requireActorUserId(ctx));
				return this._organizationPlugin!.getOrganization(ctx, {
					actorUserId,
					organizationId: args.organizationId,
				});
			},
			getMembership: async (ctx, args) => {
				const actorUserId =
					args.actorUserId ?? (await this.requireActorUserId(ctx));
				return this._organizationPlugin!.getMembership(ctx, {
					actorUserId,
					organizationId: args.organizationId,
				});
			},
			listMembers: async (ctx, args) => {
				const actorUserId =
					args.actorUserId ?? (await this.requireActorUserId(ctx));
				return this._organizationPlugin!.listMembers(ctx, {
					actorUserId,
					organizationId: args.organizationId,
				});
			},
			inviteMember: async (ctx, args) => {
				const actorUserId =
					args.actorUserId ?? (await this.requireActorUserId(ctx));
				return this._organizationPlugin!.inviteMember(ctx, {
					actorUserId,
					organizationId: args.organizationId,
					email: args.email,
					role: args.role,
				});
			},
			listInvitations: async (ctx, args) => {
				const actorUserId =
					args.actorUserId ?? (await this.requireActorUserId(ctx));
				return this._organizationPlugin!.listInvitations(ctx, {
					actorUserId,
					organizationId: args.organizationId,
				});
			},
			listIncomingInvitations: async (ctx, args = {}) => {
				const actorUserId =
					args.actorUserId ?? (await this.requireActorUserId(ctx));
				return this._organizationPlugin!.listIncomingInvitations(ctx, {
					actorUserId,
				});
			},
				acceptInvitation: async (ctx, args) => {
					const actorUserId =
						args.actorUserId ?? (await this.requireActorUserId(ctx));
					return this._organizationPlugin!.acceptInvitation(ctx, {
						actorUserId,
						token: args.token,
					});
				},
				acceptIncomingInvitation: async (ctx, args) => {
					const actorUserId =
						args.actorUserId ?? (await this.requireActorUserId(ctx));
					return this._organizationPlugin!.acceptIncomingInvitation(ctx, {
						actorUserId,
						invitationId: args.invitationId,
					});
				},
				cancelInvitation: async (ctx, args) => {
					const actorUserId =
						args.actorUserId ?? (await this.requireActorUserId(ctx));
					return this._organizationPlugin!.cancelInvitation(ctx, {
						actorUserId,
						invitationId: args.invitationId,
					});
				},
				declineIncomingInvitation: async (ctx, args) => {
					const actorUserId =
						args.actorUserId ?? (await this.requireActorUserId(ctx));
					return this._organizationPlugin!.declineIncomingInvitation(ctx, {
						actorUserId,
						invitationId: args.invitationId,
					});
				},
				removeMember: async (ctx, args) => {
					const actorUserId =
						args.actorUserId ?? (await this.requireActorUserId(ctx));
				return this._organizationPlugin!.removeMember(ctx, {
					actorUserId,
					organizationId: args.organizationId,
					userId: args.userId,
				});
			},
			setMemberRole: async (ctx, args) => {
				const actorUserId =
					args.actorUserId ?? (await this.requireActorUserId(ctx));
				return this._organizationPlugin!.setMemberRole(ctx, {
					actorUserId,
					organizationId: args.organizationId,
					userId: args.userId,
					role: args.role,
				});
			},
			createRole: async (ctx, args) => {
				const actorUserId =
					args.actorUserId ?? (await this.requireActorUserId(ctx));
				const payload: {
					actorUserId: string;
					organizationId: string;
					name: string;
					slug: string;
					description?: string;
					permissions: string[];
				} = {
					actorUserId,
					organizationId: args.organizationId,
					name: args.name,
					slug: args.slug,
					permissions: args.permissions,
				};
				if (args.description !== undefined) {
					payload.description = args.description;
				}
				return this._organizationPlugin!.createRole(ctx, payload);
			},
			listRoles: async (ctx, args) => {
				const actorUserId =
					args.actorUserId ?? (await this.requireActorUserId(ctx));
				return this._organizationPlugin!.listRoles(ctx, {
					actorUserId,
					organizationId: args.organizationId,
				});
			},
			listAvailablePermissions: async (ctx, args) => {
				const actorUserId =
					args.actorUserId ?? (await this.requireActorUserId(ctx));
				return this._organizationPlugin!.listAvailablePermissions(ctx, {
					actorUserId,
					organizationId: args.organizationId,
				});
			},
			getRole: async (ctx, args) => {
				const actorUserId =
					args.actorUserId ?? (await this.requireActorUserId(ctx));
				return this._organizationPlugin!.getRole(ctx, {
					actorUserId,
					roleId: args.roleId,
				});
			},
			updateRole: async (ctx, args) => {
				const actorUserId =
					args.actorUserId ?? (await this.requireActorUserId(ctx));
				const payload: {
					actorUserId: string;
					roleId: string;
					name?: string;
					slug?: string;
					description?: string;
					permissions?: string[];
				} = {
					actorUserId,
					roleId: args.roleId,
				};
				if (args.name !== undefined) {
					payload.name = args.name;
				}
				if (args.slug !== undefined) {
					payload.slug = args.slug;
				}
				if (args.description !== undefined) {
					payload.description = args.description;
				}
				if (args.permissions !== undefined) {
					payload.permissions = args.permissions;
				}
				return this._organizationPlugin!.updateRole(ctx, payload);
			},
			deleteRole: async (ctx, args) => {
				const actorUserId =
					args.actorUserId ?? (await this.requireActorUserId(ctx));
				return this._organizationPlugin!.deleteRole(ctx, {
					actorUserId,
					roleId: args.roleId,
				});
			},
			transferOwnership: async (ctx, args) => {
				const actorUserId =
					args.actorUserId ?? (await this.requireActorUserId(ctx));
				return this._organizationPlugin!.transferOwnership(ctx, {
					actorUserId,
					organizationId: args.organizationId,
					newOwnerUserId: args.newOwnerUserId,
				});
			},
			addDomain: async (ctx, args) => {
				const actorUserId =
					args.actorUserId ?? (await this.requireActorUserId(ctx));
				return this._organizationPlugin!.addDomain(ctx, {
					actorUserId,
					organizationId: args.organizationId,
					hostname: args.hostname,
				});
			},
			listDomains: async (ctx, args) => {
				const actorUserId =
					args.actorUserId ?? (await this.requireActorUserId(ctx));
				return this._organizationPlugin!.listDomains(ctx, {
					actorUserId,
					organizationId: args.organizationId,
				});
			},
			getDomainVerificationChallenge: async (ctx, args) => {
				const actorUserId =
					args.actorUserId ?? (await this.requireActorUserId(ctx));
				return this._organizationPlugin!.getDomainVerificationChallenge(ctx, {
					actorUserId,
					domainId: args.domainId,
				});
			},
			markDomainVerified: async (ctx, args) => {
				const actorUserId =
					args.actorUserId ?? (await this.requireActorUserId(ctx));
				return this._organizationPlugin!.markDomainVerified(ctx, {
					actorUserId,
					domainId: args.domainId,
				});
			},
			removeDomain: async (ctx, args) => {
				const actorUserId =
					args.actorUserId ?? (await this.requireActorUserId(ctx));
				return this._organizationPlugin!.removeDomain(ctx, {
					actorUserId,
					domainId: args.domainId,
				});
			},
			resolveOrganizationByHost: async (ctx, args) => {
				return this._organizationPlugin!.resolveOrganizationByHost(ctx, args);
			},
			hasRole: async (ctx, args) => {
				const actorUserId =
					args.actorUserId ?? (await this.resolveUserId(ctx));
				if (!actorUserId) {
					return false;
				}
				const payload: {
					actorUserId: string;
					organizationId: string;
					role?: OrganizationRoleFor<TPlugins>;
					roles?: readonly OrganizationRoleFor<TPlugins>[];
				} = {
					actorUserId,
					organizationId: args.organizationId,
				};
				if (args.role !== undefined) {
					payload.role = args.role;
				}
				if (args.roles !== undefined) {
					payload.roles = args.roles;
				}
				return this._organizationPlugin!.hasRole(ctx, payload);
			},
			requireRole: async (ctx, args) => {
				const actorUserId =
					args.actorUserId ?? (await this.requireActorUserId(ctx));
				const payload: {
					actorUserId: string;
					organizationId: string;
					role?: OrganizationRoleFor<TPlugins>;
					roles?: readonly OrganizationRoleFor<TPlugins>[];
				} = {
					actorUserId,
					organizationId: args.organizationId,
				};
				if (args.role !== undefined) {
					payload.role = args.role;
				}
				if (args.roles !== undefined) {
					payload.roles = args.roles;
				}
				return this._organizationPlugin!.requireRole(ctx, payload);
			},
			hasPermission: async (ctx, args) => {
				const actorUserId =
					args.actorUserId ?? (await this.resolveUserId(ctx));
				if (!actorUserId) {
					return false;
				}
				const payload: Parameters<
					NonNullable<OrganizationPluginFor<TPlugins>>["hasPermission"]
				>[1] = {
					actorUserId,
					organizationId: args.organizationId,
					permission: args.permission as Parameters<
						NonNullable<OrganizationPluginFor<TPlugins>>["hasPermission"]
					>[1]["permission"],
				};
				return this._organizationPlugin!.hasPermission(ctx, payload);
			},
			requirePermission: async (ctx, args) => {
				const actorUserId =
					args.actorUserId ?? (await this.requireActorUserId(ctx));
				const payload: Parameters<
					NonNullable<OrganizationPluginFor<TPlugins>>["requirePermission"]
				>[1] = {
					actorUserId,
					organizationId: args.organizationId,
					permission: args.permission as Parameters<
						NonNullable<OrganizationPluginFor<TPlugins>>["requirePermission"]
					>[1]["permission"],
				};
				return this._organizationPlugin!.requirePermission(ctx, payload);
			},
		} as OrganizationFacadeFor<TPlugins>;
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
	 * import { auth } from "./auth";
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
				handler: httpActionGeneric(async (_ctx, req) => {
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
		},
	): Promise<{ status: "verification_required" }> {
		if (!this.options.emailProvider) {
			throw new Error("emailProvider is required for email/password auth");
		}
		await this.assertPasswordPolicy({
			password: args.password,
			context: "signUp",
		});

		const result = (await ctx.runMutation(this.fn("gateway:signUp"), {
			...args,
			defaultRole: this.resolveDefaultRole(),
		})) as { status: "verification_required"; verificationCode: string | null };

		// Only send the verification email when a code was produced.
		// A null code means the address was already registered; we return the
		// same response shape to avoid revealing whether the email exists.
		if (result.verificationCode !== null) {
			await this.options.emailProvider.sendVerificationEmail(
				args.email,
				result.verificationCode,
			);
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
		args: { email: string; code: string },
	): Promise<{ status: string }> {
		return ctx.runMutation(this.fn("gateway:verifyEmail"), args) as Promise<{
			status: string;
		}>;
	}

	/**
	 * Request a password reset. Sends the reset code via emailProvider.
	 */
	async requestPasswordReset(
		ctx: ConvexCtx,
		args: { email: string; ipAddress?: string },
	): Promise<{ status: "sent" }> {
		if (!this.options.emailProvider) {
			throw new Error("emailProvider is required for password reset");
		}

		const result = (await ctx.runMutation(
			this.fn("gateway:requestPasswordReset"),
			args,
		)) as { status: "sent"; resetCode: string | null };

		if (result.resetCode) {
			await this.options.emailProvider.sendPasswordResetEmail(
				args.email,
				result.resetCode,
			);
		}

		return { status: "sent" };
	}

	/**
	 * Reset password using a verification code.
	 */
	async resetPassword(
		ctx: ConvexCtx,
		args: { email: string; code: string; newPassword: string },
	): Promise<{ status: string }> {
		await this.assertPasswordPolicy({
			password: args.newPassword,
			context: "resetPassword",
		});
		return ctx.runMutation(this.fn("gateway:resetPassword"), args) as Promise<{
			status: string;
		}>;
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
		return ctx.runMutation(this.fn("gateway:getAuthorizationUrl"), {
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
		return ctx.runAction(this.fn("gateway:handleCallback"), {
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
		return ctx.runQuery(this.fn("gateway:getCurrentUser"), {
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

		return ctx.runQuery(this.fn("gateway:getUserById"), {
			userId,
			checkBanned: this.adminConfig !== null,
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
		const explicit = this.options.tokenEncryptionSecret?.trim();
		if (explicit && explicit.length > 0) {
			return explicit;
		}
		const envVar =
			this.options.tokenEncryptionSecretEnvVar ?? "CONVEX_ZEN_SECRET";
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

	private async requireActorUserId(ctx: unknown): Promise<string> {
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
			if (!next || typeof next !== "object" || Array.isArray(next)) {
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
export {
	buildOAuthAuthorizationUrl,
	discordProvider,
	defineOAuthProvider,
	exchangeOAuthAuthorizationCode,
	githubProvider,
	googleProvider,
	requireOAuthVerifiedEmail,
} from "./providers";
export { adminPlugin } from "./plugins/admin";
export { organizationPlugin } from "./plugins/organization";
export { SessionPrimitives, createSessionPrimitives } from "./primitives";
export {
	createExpoAuthClient,
	createKeyValueStorageAuthStorage,
	createMemoryAuthStorage,
	DEFAULT_EXPO_CORE_META,
} from "./expo";
export { createRouteAuthRuntimeAdapter } from "./framework-adapter";
export {
	createNextAuthClient,
	createNextReactAuthClient,
	createNextServerAuth,
	createNextServerAuthWithHandler,
	createNextAuthApiHandler,
	coreApiPlugin,
	pluginApiPlugin,
	createNextAuthServer,
	createNextAuthServerFactory,
	createNextConvexAuth,
	createNextConvexFetchers,
	createRequestFromHeaders,
	resolveNextTrustedOriginsFromEnv,
} from "./next";
export type {
	BuiltInOAuthProviderId,
	BuildOAuthAuthorizationUrlArgs,
	ConvexAuthPlugin,
	EmailProvider,
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
	AdminPluginConfig,
	Organization,
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
	OrganizationRole,
	OrganizationRoleDefinition,
	OrganizationRoleDefinitions,
	OrganizationRoleName,
	OrganizationSlugCheckResult,
} from "../types";
export type {
	RouteAuthClientTokenSyncOptions,
	RouteAuthResolveRequestUrlContext,
	RouteAuthRoutePaths,
	RouteAuthRuntimeAdapterClient,
	RouteAuthRuntimeAdapterOptions,
	RouteAuthRuntimeClientOptions,
} from "./framework-adapter";
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
} from "./expo";
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
} from "./next";
export type {
	SessionInfo,
	SignInInput,
	SignInOutput,
	SessionTransport,
	EstablishedSession,
} from "./primitives";
