import type {
  BuildOAuthAuthorizationUrlArgs,
  DiscordProviderOptions,
  ExchangeOAuthAuthorizationCodeArgs,
  GithubProviderOptions,
  GoogleProviderOptions,
  OAuthProfile,
  OAuthProviderDefinition,
  OAuthProviderRuntime,
  OAuthProviderConfig,
  OAuthTokenResponse,
} from "../types";

const GITHUB_API_USER_AGENT = "convex-zen";

type GithubEmailRecord = {
  email: string;
  primary: boolean;
  verified: boolean;
};

type GoogleUserInfoResponse = {
  sub?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
};

type GithubUserResponse = {
  id?: string | number;
  login?: string;
  name?: string;
  email?: string | null;
  avatar_url?: string;
};

type DiscordUserResponse = {
  id?: string;
  username?: string;
  global_name?: string | null;
  discriminator?: string;
  avatar?: string | null;
  verified?: boolean;
  email?: string;
};

const oauthProviderRuntimes = new Map<
  string,
  OAuthProviderRuntime<OAuthProviderConfig>
>();

function normalizeEmail(email: string | undefined): string | undefined {
  const trimmed = email?.trim().toLowerCase();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function providerUsesPkce(provider: OAuthProviderConfig): boolean {
  return provider.id === "google" || provider.id === "github";
}

function withOptionalStringProp<TKey extends string>(
  key: TKey,
  value: string | undefined
): Partial<Record<TKey, string>> {
  if (typeof value !== "string") {
    return {};
  }
  return { [key]: value } as Partial<Record<TKey, string>>;
}

function withOptionalNumberProp<TKey extends string>(
  key: TKey,
  value: number | undefined
): Partial<Record<TKey, number>> {
  if (typeof value !== "number") {
    return {};
  }
  return { [key]: value } as Partial<Record<TKey, number>>;
}

/**
 * Default verified-email enforcement used by built-in providers and available
 * to custom providers.
 */
export function requireOAuthVerifiedEmail(
  profile: OAuthProfile
): string {
  if (!profile.email) {
    throw new Error("OAuth provider did not return an email address");
  }
  if (!profile.emailVerified) {
    throw new Error("OAuth provider did not return a verified email address");
  }
  return profile.email;
}

/**
 * Shared authorization URL builder for providers that follow standard OAuth
 * query parameters.
 */
export function buildOAuthAuthorizationUrl(
  provider: OAuthProviderConfig,
  args: BuildOAuthAuthorizationUrlArgs & {
    usePkce?: boolean;
    authorizationParams?: Record<string, string | undefined>;
  }
): string {
  const url = new URL(provider.authorizationUrl);
  url.searchParams.set("client_id", provider.clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", provider.scopes.join(" "));
  url.searchParams.set("state", args.state);

  if ((args.usePkce ?? providerUsesPkce(provider)) === true) {
    url.searchParams.set("code_challenge", args.codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");
  }

  if (args.callbackUrl) {
    url.searchParams.set("redirect_uri", args.callbackUrl);
  }

  for (const [key, value] of Object.entries(args.authorizationParams ?? {})) {
    if (typeof value === "string" && value.length > 0) {
      url.searchParams.set(key, value);
    }
  }

  return url.toString();
}

async function readTokenResponse(
  response: Response
): Promise<OAuthTokenResponse> {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const payload = (await response.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number | string;
    };
    if (!payload.access_token) {
      throw new Error("Token exchange failed: invalid provider response");
    }
    const expiresIn =
      typeof payload.expires_in === "number"
        ? payload.expires_in
        : typeof payload.expires_in === "string"
          ? Number(payload.expires_in)
          : undefined;
    return {
      accessToken: payload.access_token,
      ...withOptionalStringProp("refreshToken", payload.refresh_token),
      ...withOptionalNumberProp(
        "expiresIn",
        Number.isFinite(expiresIn) ? expiresIn : undefined
      ),
    };
  }

  const text = await response.text();
  const params = new URLSearchParams(text);
  const accessToken = params.get("access_token");
  if (!accessToken) {
    throw new Error("Token exchange failed: invalid provider response");
  }
  const expiresInRaw = params.get("expires_in");
  const expiresIn = expiresInRaw ? Number(expiresInRaw) : undefined;
  return {
    accessToken,
    ...withOptionalStringProp(
      "refreshToken",
      params.get("refresh_token") ?? undefined
    ),
    ...withOptionalNumberProp(
      "expiresIn",
      Number.isFinite(expiresIn) ? expiresIn : undefined
    ),
  };
}

/**
 * Shared code exchange helper for providers that use the standard form-encoded
 * OAuth token exchange flow.
 */
export async function exchangeOAuthAuthorizationCode(
  provider: OAuthProviderConfig,
  args: ExchangeOAuthAuthorizationCodeArgs & {
    usePkce?: boolean;
    requestHeaders?: Record<string, string>;
    requestParams?: Record<string, string | undefined>;
  }
): Promise<OAuthTokenResponse> {
  const tokenParams = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: provider.clientId,
    client_secret: provider.clientSecret,
    code: args.code,
  });

  if ((args.usePkce ?? providerUsesPkce(provider)) === true) {
    tokenParams.set("code_verifier", args.codeVerifier);
  }

  if (args.callbackUrl) {
    tokenParams.set("redirect_uri", args.callbackUrl);
  }

  for (const [key, value] of Object.entries(args.requestParams ?? {})) {
    if (typeof value === "string" && value.length > 0) {
      tokenParams.set(key, value);
    }
  }

  const headers = new Headers({
    "Content-Type": "application/x-www-form-urlencoded",
  });
  for (const [key, value] of Object.entries(args.requestHeaders ?? {})) {
    headers.set(key, value);
  }

  const tokenRes = await fetch(provider.tokenUrl, {
    method: "POST",
    headers,
    body: tokenParams.toString(),
  });

  if (!tokenRes.ok) {
    throw new Error(`Token exchange failed: ${tokenRes.status}`);
  }

  return await readTokenResponse(tokenRes);
}

function validateOAuthProviderConfig(provider: OAuthProviderConfig): void {
  const required = [
    provider.id,
    provider.clientId,
    provider.clientSecret,
    provider.authorizationUrl,
    provider.tokenUrl,
    provider.userInfoUrl,
  ];
  if (required.some((value) => value.trim().length === 0)) {
    throw new Error("Invalid OAuth provider configuration");
  }
  if (provider.scopes.length === 0) {
    throw new Error("OAuth provider scopes must not be empty");
  }

  const urls = [
    provider.authorizationUrl,
    provider.tokenUrl,
    provider.userInfoUrl,
  ];
  for (const rawUrl of urls) {
    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      throw new Error("Invalid OAuth provider URL");
    }
    if (parsed.protocol !== "https:") {
      throw new Error("OAuth provider URLs must use HTTPS");
    }
  }
}

function registerOAuthProviderRuntime<TProvider extends OAuthProviderConfig>(
  id: TProvider["id"],
  runtime: OAuthProviderRuntime<TProvider>
): void {
  const existing = oauthProviderRuntimes.get(id);
  if (existing && existing !== runtime) {
    throw new Error(
      `OAuth provider runtime "${id}" is already registered. Reuse the original provider definition instead of redefining it.`
    );
  }
  if (!existing) {
    oauthProviderRuntimes.set(
      id,
      runtime as OAuthProviderRuntime<OAuthProviderConfig>
    );
  }
}

export function resolveOAuthProviderRuntime(
  provider: OAuthProviderConfig
): OAuthProviderRuntime<OAuthProviderConfig> {
  const runtime = oauthProviderRuntimes.get(provider.id);
  if (!runtime) {
    throw new Error(
      `No OAuth provider runtime is registered for "${provider.id}". If this is a custom provider, define it in convex/zen.config.ts so it registers before auth functions run.`
    );
  }
  validateOAuthProviderConfig(provider);
  runtime.validateProvider?.(provider);
  return runtime;
}

/**
 * Define an OAuth provider factory.
 *
 * This returns a helper that produces serializable provider configs while also
 * registering a runtime implementation for the provider id. Built-in providers
 * use the exact same mechanism.
 */
export function defineOAuthProvider<
  TOptions,
  TProvider extends OAuthProviderConfig,
>(
  definition: OAuthProviderDefinition<TOptions, TProvider>
): (options: TOptions) => TProvider {
  registerOAuthProviderRuntime(definition.id, definition.runtime);
  return (options) => {
    const provider = definition.createConfig(options);
    validateOAuthProviderConfig(provider);
    definition.runtime.validateProvider?.(provider);
    return provider;
  };
}

function resolveGithubEmail(
  profile: GithubUserResponse,
  emails: readonly GithubEmailRecord[]
): { email?: string; emailVerified: boolean } {
  const verifiedPrimary =
    emails.find((email) => email.primary && email.verified) ??
    emails.find((email) => email.verified);

  if (verifiedPrimary) {
    return {
      emailVerified: true,
      ...withOptionalStringProp("email", normalizeEmail(verifiedPrimary.email)),
    };
  }

  const normalizedProfileEmail = normalizeEmail(profile.email ?? undefined);
  if (!normalizedProfileEmail) {
    return { emailVerified: false };
  }

  const profileEmailRecord = emails.find(
    (email) => normalizeEmail(email.email) === normalizedProfileEmail
  );
  return {
    emailVerified: profileEmailRecord?.verified === true,
    ...withOptionalStringProp("email", normalizedProfileEmail),
  };
}

function resolveDiscordImage(profile: DiscordUserResponse): string | undefined {
  if (!profile.id) {
    return undefined;
  }
  if (!profile.avatar) {
    const discriminator = profile.discriminator ?? "0";
    const defaultAvatarNumber =
      discriminator === "0"
        ? Number(BigInt(profile.id) >> BigInt(22)) % 6
        : parseInt(discriminator, 10) % 5;
    return `https://cdn.discordapp.com/embed/avatars/${defaultAvatarNumber}.png`;
  }
  const format = profile.avatar.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.${format}`;
}

/**
 * Google reference implementation.
 *
 * Behavior:
 * - standard PKCE flow
 * - adds Google-specific authorization params (`access_type`, `prompt`, `hd`)
 * - resolves the user from Google userinfo
 * - requires `email_verified === true`
 */
export const googleProvider = defineOAuthProvider<
  GoogleProviderOptions,
  OAuthProviderConfig
>({
  id: "google",
  createConfig: (config) => {
    const provider: OAuthProviderConfig = {
      id: "google",
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      trustVerifiedEmail: true,
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
  },
  runtime: {
    buildAuthorizationUrl: (provider, args) =>
      buildOAuthAuthorizationUrl(provider, {
        ...args,
        authorizationParams: {
          access_type: provider.accessType,
          prompt: provider.prompt,
          hd: provider.hostedDomain,
          include_granted_scopes: "true",
        },
      }),
    exchangeAuthorizationCode: async (provider, args) =>
      await exchangeOAuthAuthorizationCode(provider, args),
    fetchProfile: async (provider, tokens) => {
      const response = await fetch(provider.userInfoUrl, {
        headers: {
          Authorization: `Bearer ${tokens.accessToken}`,
        },
      });
      if (!response.ok) {
        throw new Error(`User info fetch failed: ${response.status}`);
      }
      const profile = (await response.json()) as GoogleUserInfoResponse;
      if (!profile.sub) {
        throw new Error("Could not determine provider user ID");
      }
      return {
        accountId: profile.sub,
        emailVerified: profile.email_verified === true,
        ...withOptionalStringProp("email", normalizeEmail(profile.email)),
        ...withOptionalStringProp("name", profile.name),
        ...withOptionalStringProp("image", profile.picture),
      };
    },
    requireVerifiedEmail: (profile) => requireOAuthVerifiedEmail(profile),
  },
});

/**
 * GitHub reference implementation.
 *
 * Behavior:
 * - standard PKCE flow
 * - token exchange requests JSON responses from GitHub
 * - profile comes from `/user`
 * - verified email resolution comes from `/user/emails`
 * - prefers primary verified email, then any verified email
 */
export const githubProvider = defineOAuthProvider<
  GithubProviderOptions,
  OAuthProviderConfig
>({
  id: "github",
  createConfig: (config) => {
    const provider: OAuthProviderConfig = {
      id: "github",
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      trustVerifiedEmail: true,
      authorizationUrl: "https://github.com/login/oauth/authorize",
      tokenUrl: "https://github.com/login/oauth/access_token",
      userInfoUrl: "https://api.github.com/user",
      scopes: config.scopes ?? ["read:user", "user:email"],
    };
    if (config.tokenEncryptionSecret !== undefined) {
      provider.tokenEncryptionSecret = config.tokenEncryptionSecret;
    }
    return provider;
  },
  runtime: {
    buildAuthorizationUrl: (provider, args) =>
      buildOAuthAuthorizationUrl(provider, args),
    exchangeAuthorizationCode: async (provider, args) =>
      await exchangeOAuthAuthorizationCode(provider, {
        ...args,
        requestHeaders: {
          Accept: "application/json",
        },
      }),
    fetchProfile: async (provider, tokens) => {
      const headers = {
        Authorization: `Bearer ${tokens.accessToken}`,
        "User-Agent": GITHUB_API_USER_AGENT,
        Accept: "application/vnd.github+json",
      };

      const profileRes = await fetch(provider.userInfoUrl, { headers });
      if (!profileRes.ok) {
        throw new Error(`User info fetch failed: ${profileRes.status}`);
      }

      const emailsRes = await fetch("https://api.github.com/user/emails", {
        headers,
      });
      if (!emailsRes.ok) {
        throw new Error(`User email fetch failed: ${emailsRes.status}`);
      }

      const profile = (await profileRes.json()) as GithubUserResponse;
      const emails = (await emailsRes.json()) as GithubEmailRecord[];
      const accountId = profile.id?.toString();
      if (!accountId) {
        throw new Error("Could not determine provider user ID");
      }

      const resolvedEmail = resolveGithubEmail(profile, emails);
      return {
        accountId,
        emailVerified: resolvedEmail.emailVerified,
        ...withOptionalStringProp("email", resolvedEmail.email),
        ...withOptionalStringProp("name", profile.name ?? profile.login),
        ...withOptionalStringProp("image", profile.avatar_url),
      };
    },
    requireVerifiedEmail: (profile) => requireOAuthVerifiedEmail(profile),
  },
});

/**
 * Discord reference implementation.
 *
 * Behavior:
 * - standard OAuth flow without PKCE
 * - optional `prompt` support
 * - profile comes from `/users/@me`
 * - requires `verified === true`
 * - normalizes Discord avatar URLs, including default avatar fallbacks
 */
export const discordProvider = defineOAuthProvider<
  DiscordProviderOptions,
  OAuthProviderConfig
>({
  id: "discord",
  createConfig: (config) => {
    const provider: OAuthProviderConfig = {
      id: "discord",
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      trustVerifiedEmail: true,
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
  },
  runtime: {
    buildAuthorizationUrl: (provider, args) =>
      buildOAuthAuthorizationUrl(provider, {
        ...args,
        usePkce: false,
        authorizationParams: {
          prompt: provider.prompt,
        },
      }),
    exchangeAuthorizationCode: async (provider, args) =>
      await exchangeOAuthAuthorizationCode(provider, {
        ...args,
        usePkce: false,
      }),
    fetchProfile: async (provider, tokens) => {
      const response = await fetch(provider.userInfoUrl, {
        headers: {
          Authorization: `Bearer ${tokens.accessToken}`,
        },
      });
      if (!response.ok) {
        throw new Error(`User info fetch failed: ${response.status}`);
      }
      const profile = (await response.json()) as DiscordUserResponse;
      if (!profile.id) {
        throw new Error("Could not determine provider user ID");
      }
      return {
        accountId: profile.id,
        emailVerified: profile.verified === true,
        ...withOptionalStringProp("email", normalizeEmail(profile.email)),
        ...withOptionalStringProp(
          "name",
          profile.global_name ?? profile.username ?? undefined
        ),
        ...withOptionalStringProp("image", resolveDiscordImage(profile)),
      };
    },
    requireVerifiedEmail: (profile) => requireOAuthVerifiedEmail(profile),
  },
});
