import type {
  DiscordProviderOptions,
  GithubProviderOptions,
  GoogleProviderOptions,
  OAuthProviderConfig,
} from "../types";

/** Create a Google OAuth provider configuration. */
export function googleProvider(
  config: GoogleProviderOptions
): OAuthProviderConfig {
  const provider: OAuthProviderConfig = {
    id: "google",
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    userInfoUrl: "https://www.googleapis.com/oauth2/v3/userinfo",
    scopes: config.scopes ?? ["openid", "email", "profile"],
  };
  if (config.accessType !== undefined) {
    provider.accessType = config.accessType;
  }
  if (config.prompt !== undefined) {
    provider.prompt = config.prompt;
  }
  if (config.hostedDomain !== undefined) {
    provider.hostedDomain = config.hostedDomain;
  }
  if (config.tokenEncryptionSecret !== undefined) {
    provider.tokenEncryptionSecret = config.tokenEncryptionSecret;
  }
  return provider;
}

/** Create a GitHub OAuth provider configuration. */
export function githubProvider(
  config: GithubProviderOptions
): OAuthProviderConfig {
  const provider: OAuthProviderConfig = {
    id: "github",
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    authorizationUrl: "https://github.com/login/oauth/authorize",
    tokenUrl: "https://github.com/login/oauth/access_token",
    userInfoUrl: "https://api.github.com/user",
    scopes: config.scopes ?? ["read:user", "user:email"],
  };
  if (config.tokenEncryptionSecret !== undefined) {
    provider.tokenEncryptionSecret = config.tokenEncryptionSecret;
  }
  return provider;
}

/** Create a Discord OAuth provider configuration. */
export function discordProvider(
  config: DiscordProviderOptions
): OAuthProviderConfig {
  const provider: OAuthProviderConfig = {
    id: "discord",
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    authorizationUrl: "https://discord.com/api/oauth2/authorize",
    tokenUrl: "https://discord.com/api/oauth2/token",
    userInfoUrl: "https://discord.com/api/users/@me",
    scopes: config.scopes ?? ["identify", "email"],
  };
  if (config.prompt !== undefined) {
    provider.prompt = config.prompt;
  }
  if (config.tokenEncryptionSecret !== undefined) {
    provider.tokenEncryptionSecret = config.tokenEncryptionSecret;
  }
  return provider;
}
