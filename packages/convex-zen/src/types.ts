/**
 * Core interfaces for convex-zen plugin and provider system.
 */

/** Interface for sending transactional emails. */
export interface EmailProvider {
  sendVerificationEmail(to: string, code: string): Promise<void>;
  sendPasswordResetEmail(to: string, code: string): Promise<void>;
}

export type OAuthProviderId = "google" | "github" | "discord";

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

/** OAuth provider configuration returned by factory functions. */
export interface OAuthProviderConfig {
  id: OAuthProviderId;
  clientId: string;
  clientSecret: string;
  tokenEncryptionSecret?: string;
  authorizationUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  scopes: string[];
  accessType?: "offline" | "online";
  prompt?: "none" | "consent" | "select_account";
  hostedDomain?: string;
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
