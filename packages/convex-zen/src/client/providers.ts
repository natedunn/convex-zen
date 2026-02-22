import type { OAuthProviderConfig } from "../types";

/** Create a Google OAuth provider configuration. */
export function googleProvider(config: {
  clientId: string;
  clientSecret: string;
  scopes?: string[];
}): OAuthProviderConfig {
  return {
    id: "google",
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    userInfoUrl: "https://www.googleapis.com/oauth2/v3/userinfo",
    scopes: config.scopes ?? ["openid", "email", "profile"],
  };
}

/** Create a GitHub OAuth provider configuration. */
export function githubProvider(config: {
  clientId: string;
  clientSecret: string;
  scopes?: string[];
}): OAuthProviderConfig {
  return {
    id: "github",
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    authorizationUrl: "https://github.com/login/oauth/authorize",
    tokenUrl: "https://github.com/login/oauth/access_token",
    userInfoUrl: "https://api.github.com/user",
    scopes: config.scopes ?? ["read:user", "user:email"],
  };
}
