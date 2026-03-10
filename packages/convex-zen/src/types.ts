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
