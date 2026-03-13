/**
 * Core interfaces for convex-zen plugin and provider system.
 */

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
 *
 * @experimental Subject to change until the custom provider API is stabilized.
 */
export interface OAuthTokenResponse {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
}

/**
 * Normalized profile payload used by OAuth provider runtimes.
 *
 * @experimental Subject to change until the custom provider API is stabilized.
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
 *
 * @experimental Subject to change until the custom provider API is stabilized.
 */
export interface BuildOAuthAuthorizationUrlArgs {
  state: string;
  codeChallenge: string;
  callbackUrl?: string;
}

/**
 * Arguments passed to a custom provider's token exchange implementation.
 *
 * @experimental Subject to change until the custom provider API is stabilized.
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
 *
 * @experimental Subject to change until the custom provider API is stabilized.
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
 *
 * @experimental Subject to change until the custom provider API is stabilized.
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

/** Base plugin interface. */
export interface ConvexAuthPlugin {
  id: string;
}

/** Admin plugin configuration. */
export interface AdminPluginConfig extends ConvexAuthPlugin {
  id: "admin";
  defaultRole?: string;
  adminRole?: string;
}

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

export interface OrganizationPluginConfig<
  TCustomAccessControl extends OrganizationCustomAccessControl = {},
  TCustomRoles extends OrganizationCustomRoleDefinitions<
    OrganizationAccessControl<TCustomAccessControl>
  > = {},
> extends ConvexAuthPlugin {
  id: "organization";
  allowUserOrganizationCreation?: boolean;
  inviteExpiresInMs?: number;
  subdomainSuffix?: string;
  accessControl?: TCustomAccessControl;
  roles?: OrganizationRoleDefinitions<
    OrganizationAccessControl<TCustomAccessControl>,
    TCustomRoles
  >;
}

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
