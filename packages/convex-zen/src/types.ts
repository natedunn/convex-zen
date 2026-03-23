/**
 * Core interfaces for convex-zen plugin and provider system.
 */
import type {
  DefaultFunctionArgs,
  RegisteredAction,
  RegisteredMutation,
  RegisteredQuery,
} from "convex/server";
import type { ObjectType, PropertyValidators } from "convex/values";

/** Interface for sending transactional emails. */
export interface EmailProvider {
  sendVerificationEmail(to: string, code: string): Promise<void>;
  sendPasswordResetEmail(to: string, code: string): Promise<void>;
}

export type BuiltInOAuthProviderId = "google" | "github" | "discord";
export type OAuthProviderId = BuiltInOAuthProviderId | (string & {});

export interface BaseOAuthProviderOptions {
  clientId: string;
  clientSecret: string;
  tokenEncryptionSecret?: string;
  scopes?: string[];
}

export interface GoogleProviderOptions extends BaseOAuthProviderOptions {
  accessType?: "offline" | "online";
  prompt?: "none" | "consent" | "select_account";
  hostedDomain?: string;
}

export interface GithubProviderOptions extends BaseOAuthProviderOptions {}

export interface DiscordProviderOptions extends BaseOAuthProviderOptions {
  prompt?: "none" | "consent";
}

/**
 * Serializable provider configuration stored in app auth options and passed into
 * Convex auth functions.
 *
 * Runtime behavior is resolved by provider id through the custom provider
 * registry, which lets built-in and custom providers share the same execution path.
 */
export interface OAuthProviderConfig {
  id: OAuthProviderId;
  clientId: string;
  clientSecret: string;
  /**
   * Whether this provider's verified email claims are trusted for new-user
   * creation and automatic email-based account linking.
   *
   * Built-in providers set this to `true`. Custom providers default to
   * untrusted unless they explicitly opt in.
   */
  trustVerifiedEmail?: boolean;
  tokenEncryptionSecret?: string;
  authorizationUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  scopes: string[];
  accessType?: "offline" | "online";
  prompt?: "none" | "consent" | "select_account";
  hostedDomain?: string;
  /**
   * Serializable config passed through to provider runtimes.
   * Custom providers can use this to store provider-specific options without
   * widening the stable top-level config surface for every new provider.
  */
  runtimeConfig?: unknown;
}

/**
 * Normalized token payload used by OAuth provider runtimes.
 */
export interface OAuthTokenResponse {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
}

/**
 * Normalized profile payload used by OAuth provider runtimes.
 */
export interface OAuthProfile {
  accountId: string;
  email?: string;
  emailVerified: boolean;
  name?: string;
  image?: string;
}

/**
 * Arguments passed to a custom provider's authorization URL builder.
 */
export interface BuildOAuthAuthorizationUrlArgs {
  state: string;
  codeChallenge: string;
  callbackUrl?: string;
}

/**
 * Arguments passed to a custom provider's token exchange implementation.
 */
export interface ExchangeOAuthAuthorizationCodeArgs {
  code: string;
  codeVerifier: string;
  callbackUrl?: string;
}

/**
 * Runtime contract for custom OAuth providers.
 *
 * This API is fully functional but not yet considered stable. Built-in providers
 * use the same contract so custom providers follow the same architecture.
 */
export interface OAuthProviderRuntime<
  TProvider extends OAuthProviderConfig = OAuthProviderConfig,
> {
  validateProvider?: (provider: TProvider) => void;
  buildAuthorizationUrl: (
    provider: TProvider,
    args: BuildOAuthAuthorizationUrlArgs
  ) => string;
  exchangeAuthorizationCode: (
    provider: TProvider,
    args: ExchangeOAuthAuthorizationCodeArgs
  ) => Promise<OAuthTokenResponse>;
  fetchProfile: (
    provider: TProvider,
    tokens: OAuthTokenResponse
  ) => Promise<OAuthProfile>;
  requireVerifiedEmail?: (
    profile: OAuthProfile,
    provider: TProvider
  ) => string;
}

/**
 * Provider factory definition used to create built-in and custom
 * provider helpers that share the same runtime contract.
 */
export interface OAuthProviderDefinition<
  TOptions,
  TProvider extends OAuthProviderConfig,
> {
  id: TProvider["id"];
  createConfig: (options: TOptions) => TProvider;
  runtime: OAuthProviderRuntime<TProvider>;
}

export interface OAuthStartOptions {
  callbackUrl?: string;
  redirectTo?: string;
  errorRedirectTo?: string;
  /**
   * @deprecated Use callbackUrl instead.
   */
  redirectUrl?: string;
}

export interface OAuthStartResult {
  authorizationUrl: string;
}

export type OAuthErrorCode =
  | "oauth_access_denied"
  | "oauth_callback_error"
  | "oauth_link_required"
  | "oauth_invalid_state"
  | "oauth_provider_not_found"
  | "oauth_unverified_email"
  | "oauth_email_not_found"
  | "oauth_token_exchange_failed"
  | "oauth_profile_fetch_failed";

export interface OAuthCallbackInput {
  providerId: OAuthProviderId;
  code: string;
  state: string;
  callbackUrl?: string;
  redirectTo?: string;
  errorRedirectTo?: string;
  ipAddress?: string;
  userAgent?: string;
  /**
   * @deprecated Use callbackUrl instead.
   */
  redirectUrl?: string;
}

export type AuthPluginFunctionKind = "query" | "mutation" | "action";

export type AuthPluginFunctionAuth = "public" | "actor" | "optionalActor";

export const PLUGIN_FUNCTION_METADATA_KEY = "__convexZenPluginFunction" as const;

export type PluginGatewayFieldConfig = {
  actorEmail?: boolean;
};

export type PluginFunctionMetadata = {
  kind: AuthPluginFunctionKind;
  auth: AuthPluginFunctionAuth;
  args: PropertyValidators;
  actor?: PluginGatewayFieldConfig | undefined;
};

export type PluginFunctionCarrier<
  TMetadata extends PluginFunctionMetadata = PluginFunctionMetadata,
> = {
  [PLUGIN_FUNCTION_METADATA_KEY]?: TMetadata;
};

export interface AuthPluginHooks<TOptions = unknown> {
  onUserCreated?: {
    defaultRole?: (options: TOptions) => string | undefined;
  };
  assertCanCreateSession?: boolean;
  assertCanResolveSession?: boolean;
  assertCanReadAuthUser?: boolean;
  onUserDeleted?: (
    context: PluginUserDeletedHookContext<TOptions, PluginGatewayModule, object>
  ) => Promise<void> | void;
}

export type PluginGatewayActorMetadata = {
  actorEmail?: boolean;
};

export type PluginGatewayFunctionMetadata = {
  kind: AuthPluginFunctionKind;
  auth: AuthPluginFunctionAuth;
  args: Record<string, unknown>;
  actor?: PluginGatewayActorMetadata | undefined;
};

export type PluginGatewayRuntimeMethods = Record<
  string,
  PluginGatewayFunctionMetadata
>;

export type PluginGatewayModule = Record<string, unknown>;
type StripInjectedPluginArgs<TArgs> = TArgs extends Record<string, unknown>
  ? Omit<TArgs, "actorUserId" | "actorEmail">
  : TArgs;

type PluginMetadataArgs<TExport> =
  TExport extends {
    __convexZenPluginFunction: { args: infer TArgs extends PropertyValidators };
  }
    ? StripInjectedPluginArgs<ObjectType<TArgs>>
    : TExport extends {
          __convexZenPluginFunction?: {
            args: infer TArgs extends PropertyValidators;
          };
        }
      ? StripInjectedPluginArgs<ObjectType<TArgs>>
      : never;

type PluginRegisteredReturn<TExport> =
  TExport extends RegisteredQuery<"public", DefaultFunctionArgs, infer TReturn>
    ? Awaited<TReturn> extends void
      ? null
      : Awaited<TReturn>
    : TExport extends RegisteredMutation<
          "public",
          DefaultFunctionArgs,
          infer TReturn
        >
      ? Awaited<TReturn> extends void
        ? null
        : Awaited<TReturn>
      : TExport extends RegisteredAction<
            "public",
            DefaultFunctionArgs,
            infer TReturn
          >
        ? Awaited<TReturn> extends void
          ? null
          : Awaited<TReturn>
        : never;

type PluginGatewayFunctionExport<TExport> =
  [PluginMetadataArgs<TExport>] extends [never]
    ? TExport extends RegisteredQuery<"public", infer TArgs, infer TReturn>
      ? {
          args: StripInjectedPluginArgs<TArgs>;
          return: Awaited<TReturn> extends void ? null : Awaited<TReturn>;
        }
      : TExport extends RegisteredMutation<"public", infer TArgs, infer TReturn>
        ? {
            args: StripInjectedPluginArgs<TArgs>;
            return: Awaited<TReturn> extends void ? null : Awaited<TReturn>;
          }
        : TExport extends RegisteredAction<"public", infer TArgs, infer TReturn>
          ? {
              args: StripInjectedPluginArgs<TArgs>;
              return: Awaited<TReturn> extends void ? null : Awaited<TReturn>;
            }
          : never
    : {
        args: PluginMetadataArgs<TExport>;
        return: PluginRegisteredReturn<TExport>;
      };

export type PluginGatewayFunctionArgs<TExport> =
  PluginGatewayFunctionExport<TExport> extends infer TFunction
    ? [TFunction] extends [never]
      ? never
      : TFunction extends { args: infer TArgs }
        ? TArgs
        : never
    : never;

export type PluginGatewayFunctionReturn<TExport> =
  PluginGatewayFunctionExport<TExport> extends infer TFunction
    ? [TFunction] extends [never]
      ? never
      : TFunction extends { return: infer TReturn }
        ? TReturn
        : never
    : never;

export type PluginGatewayRuntimeMap<TGateway extends PluginGatewayModule> = {
  [TMethod in Extract<keyof TGateway, string> as PluginGatewayFunctionExport<
    TGateway[TMethod]
  > extends never
    ? never
    : TMethod]: (
    ctx: unknown,
    args: PluginGatewayFunctionArgs<TGateway[TMethod]>
  ) => Promise<PluginGatewayFunctionReturn<TGateway[TMethod]>>;
};

export interface PluginRuntimeExtensionContext<
  TOptions = unknown,
  TGateway extends PluginGatewayModule = PluginGatewayModule,
> {
  component: Record<string, unknown>;
  childName: string;
  runtimeKind: "app" | "component";
  options: TOptions;
  gateway: PluginGatewayRuntimeMap<TGateway>;
  requireActorUserId: (ctx: unknown) => Promise<string>;
  resolveUserId: (ctx: unknown) => Promise<string | null>;
  callInternalMutation: (
    ctx: unknown,
    functionName: string,
    args: Record<string, unknown>
  ) => Promise<unknown>;
  deleteAuthUser: (ctx: unknown, userId: string) => Promise<void>;
}

export interface PluginUserDeletedHookContext<
  TOptions = unknown,
  TGateway extends PluginGatewayModule = PluginGatewayModule,
  TRuntimeExtension extends object = {},
> {
  ctx: unknown;
  userId: string;
  options: TOptions;
  runtime: PluginGatewayRuntimeMap<TGateway> & TRuntimeExtension;
}

export interface PluginDefinition<
  TId extends string = string,
  TOptions = unknown,
  TGateway extends PluginGatewayModule = PluginGatewayModule,
  TRuntimeExtension extends object = {},
> {
  id: TId;
  gateway: TGateway;
  normalizeOptions?: (options: TOptions | undefined) => TOptions;
  optionsSchema?: unknown;
  extendRuntime?: (
    context: PluginRuntimeExtensionContext<TOptions, TGateway>
  ) => TRuntimeExtension;
  hooks?: AuthPluginHooks<TOptions> & {
    onUserDeleted?: (
      context: PluginUserDeletedHookContext<TOptions, TGateway, TRuntimeExtension>
    ) => Promise<void> | void;
  };
}

export interface ConvexAuthPlugin<
  TDefinition extends PluginDefinition<any, any, any, any> = PluginDefinition<
    any,
    any,
    any
  >,
> {
  id: TDefinition["id"];
  definition: TDefinition;
  options: TDefinition extends PluginDefinition<any, infer TOptions, any, any>
    ? TOptions
    : never;
}

export interface AuthPluginFactory<
  TDefinition extends PluginDefinition<any, any, any, any> = PluginDefinition<
    any,
    any,
    any
  >,
> {
  (
    options?: TDefinition extends PluginDefinition<any, infer TOptions, any, any>
      ? TOptions
      : never
  ): ConvexAuthPlugin<TDefinition>;
  definition: TDefinition;
}

export function definePlugin<
  TId extends string,
  TOptions,
  TGateway extends PluginGatewayModule,
  TRuntimeExtension extends object,
>(
  definition: PluginDefinition<TId, TOptions, TGateway, TRuntimeExtension>
): AuthPluginFactory<PluginDefinition<TId, TOptions, TGateway, TRuntimeExtension>> {
  const factory = ((
    options?: TOptions
  ): ConvexAuthPlugin<PluginDefinition<TId, TOptions, TGateway, TRuntimeExtension>> => ({
    id: definition.id,
    definition,
    options: definition.normalizeOptions
      ? definition.normalizeOptions(options)
      : (options as TOptions),
  })) as AuthPluginFactory<PluginDefinition<TId, TOptions, TGateway, TRuntimeExtension>>;
  factory.definition = definition;
  return factory;
}

/** Admin plugin options. */
export interface AdminPluginOptions {
  defaultRole?: string;
  adminRole?: string;
}

export type AdminPluginConfig = AdminPluginOptions;

export type BuiltInOrganizationRole = "owner" | "admin" | "member";
export type OrganizationRole = BuiltInOrganizationRole;

type OrganizationAccessControlResourceKey<TAccessControl> = Extract<
  keyof TAccessControl,
  string
>;

type OrganizationAccessControlAction<
  TAccessControl,
  TResource extends OrganizationAccessControlResourceKey<TAccessControl>,
> = TAccessControl[TResource] extends readonly (infer TAction)[]
  ? Extract<TAction, string>
  : never;

export interface BuiltInOrganizationAccessControl {
  organization: readonly ["read", "update", "delete", "transfer"];
  accessControl: readonly ["read"];
  role: readonly ["read", "create", "update", "delete"];
  member: readonly ["read", "create", "update", "delete"];
  invitation: readonly ["read", "create", "cancel", "accept"];
  domain: readonly ["read", "create", "verify", "delete"];
}

export type OrganizationCustomAccessControl = Record<string, readonly string[]>;

export type OrganizationAccessControl<
  TCustomAccessControl extends OrganizationCustomAccessControl = {},
> = BuiltInOrganizationAccessControl & TCustomAccessControl;

export type OrganizationRoleDefinition<
  TAccessControl,
> = Partial<{
  [TResource in OrganizationAccessControlResourceKey<TAccessControl>]:
    readonly OrganizationAccessControlAction<TAccessControl, TResource>[];
}>;

export type OrganizationCustomRoleDefinitions<
  TAccessControl,
> = Record<string, OrganizationRoleDefinition<TAccessControl>>;

export type OrganizationRoleDefinitions<
  TAccessControl,
  TCustomRoles extends OrganizationCustomRoleDefinitions<TAccessControl> = {},
> = TCustomRoles &
  Partial<
    Record<
      BuiltInOrganizationRole,
      OrganizationRoleDefinition<TAccessControl>
    >
  >;

export type OrganizationRoleName<
  TCustomRoles extends Record<string, unknown> = {},
> = BuiltInOrganizationRole | Extract<keyof TCustomRoles, string>;

export type OrganizationPermission<
  TAccessControl,
  TResource extends OrganizationAccessControlResourceKey<TAccessControl> = OrganizationAccessControlResourceKey<TAccessControl>,
> = TResource extends string
  ? {
      resource: TResource;
      action: OrganizationAccessControlAction<TAccessControl, TResource>;
    }
  : never;

export interface OrganizationPluginOptions<
  TCustomAccessControl extends OrganizationCustomAccessControl = {},
  TCustomRoles extends OrganizationCustomRoleDefinitions<
    OrganizationAccessControl<TCustomAccessControl>
  > = {},
> {
  allowUserOrganizationCreation?: boolean;
  inviteExpiresInMs?: number;
  subdomainSuffix?: string;
  accessControl?: TCustomAccessControl;
  roles?: OrganizationRoleDefinitions<
    OrganizationAccessControl<TCustomAccessControl>,
    TCustomRoles
  >;
}

export type OrganizationPluginConfig<
  TCustomAccessControl extends OrganizationCustomAccessControl = {},
  TCustomRoles extends OrganizationCustomRoleDefinitions<
    OrganizationAccessControl<TCustomAccessControl>
  > = {},
> = OrganizationPluginOptions<TCustomAccessControl, TCustomRoles>;

/** Result of a successful auth operation. */
export interface AuthResult {
  sessionToken: string;
  userId: string;
}

/** Result of session validation. */
export interface SessionResult {
  userId: string;
  sessionId: string;
}

/** Email/password sign-up result. */
export type SignUpResult =
  | { status: "verification_required" }
  | { status: "success"; sessionToken: string; userId: string };

/** Verification result. */
export type VerifyResult =
  | { status: "valid" }
  | { status: "invalid" }
  | { status: "expired" }
  | { status: "too_many_attempts" };

/** OAuth authorization URL result. */
export type OAuthUrlResult = OAuthStartResult;

/** OAuth callback result. */
export interface OAuthCallbackResult {
  sessionToken: string;
  userId: string;
  redirectTo?: string;
  /**
   * @deprecated Use redirectTo instead.
   */
  redirectUrl?: string;
}

/** Admin list-users row shape. */
export interface AdminListUser {
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
  _creationTime?: number;
}

/** Admin list-users response shape. */
export interface AdminListUsersResult<
  TUser extends AdminListUser = AdminListUser,
> {
  users: TUser[];
  cursor: string | null;
  isDone: boolean;
}

export interface Organization {
  _id: string;
  name: string;
  slug: string;
  logo?: string;
  createdByUserId: string;
  createdAt: number;
  updatedAt: number;
  _creationTime?: number;
}

export interface OrganizationRoleRecord {
  _id: string;
  organizationId: string;
  name: string;
  slug: string;
  description?: string;
  permissions: string[];
  createdByUserId: string;
  createdAt: number;
  updatedAt: number;
  _creationTime?: number;
}

export type OrganizationRoleAssignment =
  | {
      roleType: "system";
      roleName: BuiltInOrganizationRole;
      systemRole: BuiltInOrganizationRole;
      customRoleId?: undefined;
    }
  | {
      roleType: "custom";
      roleName: string;
      customRoleId: string;
      systemRole?: undefined;
    };

export type OrganizationRoleAssignmentInput =
  | {
      type: "system";
      systemRole: BuiltInOrganizationRole;
      customRoleId?: undefined;
    }
  | {
      type: "custom";
      customRoleId: string;
      systemRole?: undefined;
    };

export interface OrganizationMembership {
  _id: string;
  organizationId: string;
  userId: string;
  roleType: "system" | "custom";
  roleName: string;
  systemRole?: BuiltInOrganizationRole;
  customRoleId?: string;
  createdAt: number;
  updatedAt: number;
  _creationTime?: number;
}

export interface OrganizationInvitation {
  _id: string;
  organizationId: string;
  email: string;
  roleType: "system" | "custom";
  roleName: string;
  systemRole?: BuiltInOrganizationRole;
  customRoleId?: string;
  invitedByUserId: string;
  expiresAt: number;
  acceptedAt?: number;
  cancelledAt?: number;
  declinedAt?: number;
  createdAt: number;
  updatedAt: number;
  _creationTime?: number;
}

export interface OrganizationIncomingInvitation extends OrganizationInvitation {
  organization: Organization;
}

export interface OrganizationDomain {
  _id: string;
  organizationId: string;
  hostname: string;
  verifiedAt?: number;
  createdAt: number;
  updatedAt: number;
  _creationTime?: number;
}

export interface OrganizationMemberUser {
  _id: string;
  email: string;
  emailVerified: boolean;
  name?: string;
  image?: string;
}

export interface OrganizationMember extends OrganizationMembership {
  user: OrganizationMemberUser;
}

export interface OrganizationListItem {
  organization: Organization;
  membership: OrganizationMembership;
}

export interface OrganizationListResult {
  organizations: OrganizationListItem[];
}

export interface OrganizationInviteResult {
  invitation: OrganizationInvitation;
  token: string;
}

export interface OrganizationRoleListResult {
  roles: OrganizationRoleRecord[];
}

export interface OrganizationAvailablePermissionsResult {
  resources: Record<string, string[]>;
  permissions: string[];
}

export interface OrganizationDomainVerificationChallenge {
  domainId: string;
  hostname: string;
  txtRecordName: string;
  txtRecordValue: string;
}

export interface OrganizationSlugCheckResult {
  slug: string;
  available: boolean;
}
