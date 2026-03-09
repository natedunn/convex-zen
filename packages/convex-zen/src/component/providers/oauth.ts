import { v, type GenericId } from "convex/values";
import {
  internalAction,
  internalMutation,
  type ActionCtx,
  type MutationCtx,
  type DatabaseWriter,
} from "../_generated/server";
import {
  encryptString,
  generateCodeChallenge,
  generateCodeVerifier,
  generateState,
  hashToken,
} from "../lib/crypto";
import { oauthProviderConfigValidator } from "../lib/validators";
import { internal } from "../lib/internalApi";
import type {
  OAuthCallbackResult,
  OAuthProviderConfig,
  OAuthProviderId,
  OAuthStartOptions,
  OAuthStartResult,
} from "../../types";
import {
  findAccount,
  findUserByEmail,
  findUserById,
  insertAccount,
  insertUser,
  patchAccount,
  patchUser,
} from "../core/users";
import { createSession } from "../core/sessions";

/** OAuth state TTL: 10 minutes. */
const STATE_TTL_MS = 10 * 60 * 1000;
const GITHUB_API_USER_AGENT = "convex-zen";

type StoredOAuthStateRecord = {
  _id: GenericId<"oauthStates">;
  provider: string;
  codeVerifier: string;
  redirectUrl?: string;
  callbackUrl?: string;
  redirectTo?: string;
  errorRedirectTo?: string;
  expiresAt: number;
};

type OAuthTokenResponse = {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
};

type OAuthNormalizedProfile = {
  accountId: string;
  email?: string;
  emailVerified: boolean;
  name?: string;
  image?: string;
};

type GithubEmailRecord = {
  email: string;
  primary: boolean;
  verified: boolean;
  visibility?: "public" | "private" | null;
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

function assertValidProviderConfig(provider: OAuthProviderConfig): void {
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

  const supportedProviderIds = new Set<OAuthProviderId>([
    "google",
    "github",
    "discord",
  ]);
  if (!supportedProviderIds.has(provider.id)) {
    throw new Error(`Unsupported OAuth provider "${provider.id}"`);
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

function resolveCallbackUrl(
  options: Pick<OAuthStartOptions, "callbackUrl" | "redirectUrl"> | undefined
): string | undefined {
  return options?.callbackUrl ?? options?.redirectUrl;
}

function providerUsesPkce(provider: OAuthProviderConfig): boolean {
  return provider.id === "google" || provider.id === "github";
}

function normalizeEmail(email: string | undefined): string | undefined {
  const trimmed = email?.trim().toLowerCase();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function assertRelativeRedirectTarget(
  target: string | undefined,
  fieldName: "redirectTo" | "errorRedirectTo"
): void {
  if (target === undefined) {
    return;
  }
  if (!target.startsWith("/") || target.startsWith("//")) {
    throw new Error(
      `${fieldName} must be a relative path that stays on the current origin`
    );
  }
}

async function readTokenResponse(response: Response): Promise<OAuthTokenResponse> {
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
      refreshToken: payload.refresh_token,
      expiresIn: Number.isFinite(expiresIn) ? expiresIn : undefined,
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
    refreshToken: params.get("refresh_token") ?? undefined,
    expiresIn: Number.isFinite(expiresIn) ? expiresIn : undefined,
  };
}

function buildAuthorizationUrl(
  provider: OAuthProviderConfig,
  args: {
    state: string;
    codeChallenge: string;
    callbackUrl?: string;
  }
): string {
  const url = new URL(provider.authorizationUrl);
  url.searchParams.set("client_id", provider.clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", provider.scopes.join(" "));
  url.searchParams.set("state", args.state);

  if (providerUsesPkce(provider)) {
    url.searchParams.set("code_challenge", args.codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");
  }

  if (args.callbackUrl) {
    url.searchParams.set("redirect_uri", args.callbackUrl);
  }

  if (provider.id === "google") {
    if (provider.accessType) {
      url.searchParams.set("access_type", provider.accessType);
    }
    if (provider.prompt) {
      url.searchParams.set("prompt", provider.prompt);
    }
    if (provider.hostedDomain) {
      url.searchParams.set("hd", provider.hostedDomain);
    }
    url.searchParams.set("include_granted_scopes", "true");
  }

  if (provider.id === "discord" && provider.prompt) {
    url.searchParams.set("prompt", provider.prompt);
  }

  return url.toString();
}

async function exchangeAuthorizationCode(
  provider: OAuthProviderConfig,
  args: {
    code: string;
    codeVerifier: string;
    callbackUrl?: string;
  }
): Promise<OAuthTokenResponse> {
  const tokenParams = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: provider.clientId,
    client_secret: provider.clientSecret,
    code: args.code,
  });

  if (providerUsesPkce(provider)) {
    tokenParams.set("code_verifier", args.codeVerifier);
  }

  if (args.callbackUrl) {
    tokenParams.set("redirect_uri", args.callbackUrl);
  }

  const headers = new Headers({
    "Content-Type": "application/x-www-form-urlencoded",
  });

  if (provider.id === "github") {
    headers.set("Accept", "application/json");
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

async function fetchGoogleProfile(
  provider: OAuthProviderConfig,
  tokens: OAuthTokenResponse
): Promise<OAuthNormalizedProfile> {
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
    email: normalizeEmail(profile.email),
    emailVerified: profile.email_verified === true,
    name: profile.name,
    image: profile.picture,
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
      email: normalizeEmail(verifiedPrimary.email),
      emailVerified: true,
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
    email: normalizedProfileEmail,
    emailVerified: profileEmailRecord?.verified === true,
  };
}

async function fetchGithubProfile(
  provider: OAuthProviderConfig,
  tokens: OAuthTokenResponse
): Promise<OAuthNormalizedProfile> {
  const headers = {
    Authorization: `Bearer ${tokens.accessToken}`,
    "User-Agent": GITHUB_API_USER_AGENT,
    Accept: "application/vnd.github+json",
  };

  const profileRes = await fetch(provider.userInfoUrl, { headers });
  if (!profileRes.ok) {
    throw new Error(`User info fetch failed: ${profileRes.status}`);
  }

  const emailsRes = await fetch("https://api.github.com/user/emails", { headers });
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
    email: resolvedEmail.email,
    emailVerified: resolvedEmail.emailVerified,
    name: profile.name ?? profile.login,
    image: profile.avatar_url,
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

async function fetchDiscordProfile(
  provider: OAuthProviderConfig,
  tokens: OAuthTokenResponse
): Promise<OAuthNormalizedProfile> {
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
    email: normalizeEmail(profile.email),
    emailVerified: profile.verified === true,
    name: profile.global_name ?? profile.username ?? undefined,
    image: resolveDiscordImage(profile),
  };
}

async function fetchNormalizedProfile(
  provider: OAuthProviderConfig,
  tokens: OAuthTokenResponse
): Promise<OAuthNormalizedProfile> {
  switch (provider.id) {
    case "google":
      return await fetchGoogleProfile(provider, tokens);
    case "github":
      return await fetchGithubProfile(provider, tokens);
    case "discord":
      return await fetchDiscordProfile(provider, tokens);
  }
  throw new Error(`Unsupported OAuth provider "${provider.id}"`);
}

function requireVerifiedEmail(profile: OAuthNormalizedProfile): string {
  if (!profile.email) {
    throw new Error("OAuth provider did not return an email address");
  }
  if (!profile.emailVerified) {
    throw new Error("OAuth provider did not return a verified email address");
  }
  return profile.email;
}

export async function storeOAuthStateRecord(
  db: DatabaseWriter,
  args: {
    stateHash: string;
    codeVerifier: string;
    provider: string;
    redirectUrl?: string;
    callbackUrl?: string;
    redirectTo?: string;
    errorRedirectTo?: string;
    expiresAt: number;
  }
): Promise<void> {
  const now = Date.now();
  const oauthStateDoc: {
    stateHash: string;
    codeVerifier: string;
    provider: string;
    expiresAt: number;
    createdAt: number;
    redirectUrl?: string;
    callbackUrl?: string;
    redirectTo?: string;
    errorRedirectTo?: string;
  } = {
    stateHash: args.stateHash,
    codeVerifier: args.codeVerifier,
    provider: args.provider,
    expiresAt: args.expiresAt,
    createdAt: now,
  };
  if (args.redirectUrl !== undefined) {
    oauthStateDoc.redirectUrl = args.redirectUrl;
  }
  if (args.callbackUrl !== undefined) {
    oauthStateDoc.callbackUrl = args.callbackUrl;
  }
  if (args.redirectTo !== undefined) {
    oauthStateDoc.redirectTo = args.redirectTo;
  }
  if (args.errorRedirectTo !== undefined) {
    oauthStateDoc.errorRedirectTo = args.errorRedirectTo;
  }
  await db.insert("oauthStates", oauthStateDoc);
}

export async function consumeOAuthStateRecord(
  db: DatabaseWriter,
  stateHash: string
): Promise<StoredOAuthStateRecord | null> {
  const record = await db
    .query("oauthStates")
    .withIndex("by_stateHash", (q) => q.eq("stateHash", stateHash))
    .unique();

  if (!record) {
    return null;
  }

  await db.delete(record._id);

  if (record.expiresAt < Date.now()) {
    return null;
  }

  return record;
}

export async function cleanupExpiredOAuthStates(
  db: DatabaseWriter
): Promise<void> {
  const now = Date.now();
  const allStates = await db.query("oauthStates").collect();
  for (const state of allStates) {
    if (state.expiresAt < now) {
      await db.delete(state._id);
    }
  }
}

export async function getAuthorizationUrlForProvider(
  ctx: MutationCtx,
  args: {
    provider: OAuthProviderConfig;
    options?: OAuthStartOptions;
  }
): Promise<OAuthStartResult> {
  const provider = args.provider;
  assertValidProviderConfig(provider);
  assertRelativeRedirectTarget(args.options?.redirectTo, "redirectTo");
  assertRelativeRedirectTarget(
    args.options?.errorRedirectTo,
    "errorRedirectTo"
  );

  const state = generateState();
  const stateHash = await hashToken(state);
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const expiresAt = Date.now() + STATE_TTL_MS;
  const callbackUrl = resolveCallbackUrl(args.options);

  await storeOAuthStateRecord(ctx.db, {
    stateHash,
    codeVerifier,
    provider: provider.id,
    redirectUrl: args.options?.redirectUrl,
    callbackUrl,
    redirectTo: args.options?.redirectTo,
    errorRedirectTo: args.options?.errorRedirectTo,
    expiresAt,
  });
  await ctx.scheduler.runAt(expiresAt, internal.providers.oauth.cleanup, {});

  return {
    authorizationUrl: buildAuthorizationUrl(provider, {
      state,
      codeChallenge,
      callbackUrl,
    }),
  };
}

export async function handleOAuthCallbackForProvider(
  ctx: ActionCtx,
  args: {
    provider: OAuthProviderConfig;
    code: string;
    state: string;
    callbackUrl?: string;
    redirectUrl?: string;
    ipAddress?: string;
    userAgent?: string;
    defaultRole?: string;
  }
): Promise<OAuthCallbackResult> {
  const provider = args.provider;
  assertValidProviderConfig(provider);

  const stateHash = await hashToken(args.state);
  const stateRecord = await ctx.runMutation(
    internal.providers.oauth.consumeOAuthState,
    { stateHash }
  );

  if (!stateRecord) {
    throw new Error("Invalid or expired OAuth state");
  }

  if (stateRecord.provider !== provider.id) {
    throw new Error("Provider mismatch in OAuth state");
  }

  const callbackUrl =
    args.callbackUrl ??
    args.redirectUrl ??
    stateRecord.callbackUrl ??
    stateRecord.redirectUrl;

  const tokens = await exchangeAuthorizationCode(provider, {
    code: args.code,
    codeVerifier: stateRecord.codeVerifier,
    callbackUrl,
  });

  const tokenEncryptionSecret =
    provider.tokenEncryptionSecret?.trim() || provider.clientSecret;
  const encryptedAccessToken = await encryptString(
    tokens.accessToken,
    tokenEncryptionSecret
  );
  const encryptedRefreshToken = tokens.refreshToken
    ? await encryptString(tokens.refreshToken, tokenEncryptionSecret)
    : undefined;

  const profile = await fetchNormalizedProfile(provider, tokens);
  const email = requireVerifiedEmail(profile);

  const accessTokenExpiresAt = tokens.expiresIn
    ? Date.now() + tokens.expiresIn * 1000
    : undefined;

  const result = await ctx.runMutation(
    internal.providers.oauth.finalizeCallback,
    {
      providerId: provider.id,
      accountId: profile.accountId,
      email,
      name: profile.name,
      image: profile.image,
      encryptedAccessToken,
      encryptedRefreshToken,
      accessTokenExpiresAt,
      ipAddress: args.ipAddress,
      userAgent: args.userAgent,
      defaultRole: args.defaultRole,
    }
  );

  return {
    ...result,
    redirectTo: stateRecord.redirectTo,
    redirectUrl: stateRecord.redirectTo,
  };
}

/** Store OAuth state and code verifier for PKCE flow. */
export const storeOAuthState = internalMutation({
  args: {
    stateHash: v.string(),
    codeVerifier: v.string(),
    provider: v.string(),
    redirectUrl: v.optional(v.string()),
    callbackUrl: v.optional(v.string()),
    redirectTo: v.optional(v.string()),
    errorRedirectTo: v.optional(v.string()),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    await storeOAuthStateRecord(ctx.db, args);
  },
});

/** Retrieve and delete an OAuth state record by state hash (single-use). */
export const consumeOAuthState = internalMutation({
  args: { stateHash: v.string() },
  handler: async (ctx, { stateHash }) => {
    return await consumeOAuthStateRecord(ctx.db, stateHash);
  },
});

/** Cleanup expired OAuth state rows (intended to be scheduled). */
export const cleanup = internalMutation({
  args: {},
  handler: async (ctx) => await cleanupExpiredOAuthStates(ctx.db),
});

/**
 * Initiate an OAuth authorization flow.
 * Returns the authorization URL with PKCE + state parameters.
 */
export const getAuthorizationUrl = internalMutation({
  args: {
    provider: oauthProviderConfigValidator,
    callbackUrl: v.optional(v.string()),
    redirectTo: v.optional(v.string()),
    errorRedirectTo: v.optional(v.string()),
    redirectUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) =>
    await getAuthorizationUrlForProvider(ctx, {
      provider: args.provider as OAuthProviderConfig,
      options: {
        callbackUrl: args.callbackUrl,
        redirectTo: args.redirectTo,
        errorRedirectTo: args.errorRedirectTo,
        redirectUrl: args.redirectUrl,
      },
    }),
});

export const finalizeCallback = internalMutation({
  args: {
    providerId: v.string(),
    accountId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    encryptedAccessToken: v.string(),
    encryptedRefreshToken: v.optional(v.string()),
    accessTokenExpiresAt: v.optional(v.number()),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    defaultRole: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existingAccount = await findAccount(
      ctx.db,
      args.providerId,
      args.accountId
    );

    let userId: GenericId<"users">;

    if (existingAccount) {
      await patchAccount(ctx.db, existingAccount._id, {
        accessToken: args.encryptedAccessToken,
        refreshToken: args.encryptedRefreshToken,
        accessTokenExpiresAt: args.accessTokenExpiresAt,
      });
      userId = existingAccount.userId;
    } else {
      const existingUser = await findUserByEmail(ctx.db, args.email);

      if (!existingUser) {
        userId = await insertUser(ctx.db, {
          email: args.email,
          emailVerified: true,
          name: args.name,
          image: args.image,
          role: args.defaultRole,
        });
      } else {
        userId = existingUser._id;
        await patchUser(ctx.db, existingUser._id, {
          emailVerified: true,
          name: existingUser.name ?? args.name,
          image: existingUser.image ?? args.image,
        });
      }

      await insertAccount(ctx.db, {
        userId,
        providerId: args.providerId,
        accountId: args.accountId,
        accessToken: args.encryptedAccessToken,
        refreshToken: args.encryptedRefreshToken,
        accessTokenExpiresAt: args.accessTokenExpiresAt,
      });
    }

    const user = await findUserById(ctx.db, userId);
    if (user?.banned) {
      const now = Date.now();
      if (user.banExpires === undefined || user.banExpires > now) {
        throw new Error(
          `Account banned${user.banReason ? ": " + user.banReason : ""}`
        );
      }
    }

    const sessionToken = await createSession(ctx.db, {
      userId,
      ipAddress: args.ipAddress,
      userAgent: args.userAgent,
    });

    return {
      sessionToken,
      userId,
    };
  },
});

/**
 * Handle the OAuth callback.
 * Validates state, exchanges code for tokens, upserts user, creates session.
 */
export const handleCallback = internalAction({
  args: {
    provider: oauthProviderConfigValidator,
    code: v.string(),
    state: v.string(),
    callbackUrl: v.optional(v.string()),
    redirectUrl: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    defaultRole: v.optional(v.string()),
  },
  handler: async (ctx, args) =>
    await handleOAuthCallbackForProvider(ctx, {
      provider: args.provider as OAuthProviderConfig,
      code: args.code,
      state: args.state,
      callbackUrl: args.callbackUrl,
      redirectUrl: args.redirectUrl,
      ipAddress: args.ipAddress,
      userAgent: args.userAgent,
      defaultRole: args.defaultRole,
    }),
});
