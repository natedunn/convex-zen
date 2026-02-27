/**
 * Core interfaces for convex-zen plugin and provider system.
 */

/** Interface for sending transactional emails. */
export interface EmailProvider {
  sendVerificationEmail(to: string, code: string): Promise<void>;
  sendPasswordResetEmail(to: string, code: string): Promise<void>;
}

/** OAuth provider configuration returned by factory functions. */
export interface OAuthProviderConfig {
  id: string;          // "google" | "github"
  clientId: string;
  clientSecret: string;
  tokenEncryptionSecret?: string;
  authorizationUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  scopes: string[];
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
export interface OAuthUrlResult {
  authorizationUrl: string;
}

/** OAuth callback result. */
export interface OAuthCallbackResult {
  sessionToken: string;
  userId: string;
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
