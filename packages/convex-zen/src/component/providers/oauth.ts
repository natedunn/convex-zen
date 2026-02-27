import { v, type GenericId } from "convex/values";
import {
  internalAction,
  internalMutation,
  type ActionCtx,
  type DatabaseWriter,
} from "../_generated/server";
import {
  generateState,
  generateCodeVerifier,
  generateCodeChallenge,
  encryptString,
  hashToken,
} from "../lib/crypto";
import { oauthProviderConfigValidator } from "../lib/validators";
import { internal } from "../lib/internalApi";
import type { OAuthProviderConfig } from "../../types";
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

  const urls = [provider.authorizationUrl, provider.tokenUrl, provider.userInfoUrl];
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

export async function storeOAuthStateRecord(
  db: DatabaseWriter,
  args: {
    stateHash: string;
    codeVerifier: string;
    provider: string;
    redirectUrl?: string;
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
  await db.insert("oauthStates", oauthStateDoc);
}

export async function consumeOAuthStateRecord(
  db: DatabaseWriter,
  stateHash: string
): Promise<{
  _id: GenericId<"oauthStates">;
  provider: string;
  codeVerifier: string;
  redirectUrl?: string;
  expiresAt: number;
} | null> {
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

export async function getAuthorizationUrlForProvider(
  ctx: ActionCtx,
  args: {
    provider: OAuthProviderConfig;
    redirectUrl?: string;
  }
): Promise<{ authorizationUrl: string }> {
  const provider = args.provider;
  assertValidProviderConfig(provider);

  const state = generateState();
  const stateHash = await hashToken(state);
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const expiresAt = Date.now() + STATE_TTL_MS;

  await ctx.runMutation(internal.providers.oauth.storeOAuthState, {
    stateHash,
    codeVerifier,
    provider: provider.id,
    redirectUrl: args.redirectUrl,
    expiresAt,
  });

  const url = new URL(provider.authorizationUrl);
  url.searchParams.set("client_id", provider.clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", provider.scopes.join(" "));
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  if (args.redirectUrl) {
    url.searchParams.set("redirect_uri", args.redirectUrl);
  }

  return { authorizationUrl: url.toString() };
}

export async function handleOAuthCallbackForProvider(
  ctx: ActionCtx,
  args: {
    provider: OAuthProviderConfig;
    code: string;
    state: string;
    redirectUrl?: string;
    ipAddress?: string;
    userAgent?: string;
    defaultRole?: string;
  }
): Promise<{ sessionToken: string; userId: string; redirectUrl?: string }> {
  const provider = args.provider;
  assertValidProviderConfig(provider);
  const fetchFn = fetch;

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

  const tokenParams = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: provider.clientId,
    client_secret: provider.clientSecret,
    code: args.code,
    code_verifier: stateRecord.codeVerifier,
  });

  if (args.redirectUrl ?? stateRecord.redirectUrl) {
    tokenParams.set(
      "redirect_uri",
      (args.redirectUrl ?? stateRecord.redirectUrl)!
    );
  }

  const tokenRes = await fetchFn(provider.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: tokenParams.toString(),
  });

  if (!tokenRes.ok) {
    throw new Error(`Token exchange failed: ${tokenRes.status}`);
  }

  const tokens = await tokenRes.json() as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };

  const tokenEncryptionSecret =
    provider.tokenEncryptionSecret?.trim() || provider.clientSecret;
  const encryptedAccessToken = await encryptString(
    tokens.access_token,
    tokenEncryptionSecret
  );
  const encryptedRefreshToken = tokens.refresh_token
    ? await encryptString(tokens.refresh_token, tokenEncryptionSecret)
    : undefined;

  const userRes = await fetchFn(provider.userInfoUrl, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });

  if (!userRes.ok) {
    throw new Error(`User info fetch failed: ${userRes.status}`);
  }

  const profile = await userRes.json() as {
    id?: string;
    sub?: string;
    email?: string;
    name?: string;
    picture?: string;
    avatar_url?: string;
    login?: string;
  };

  const accountId = (profile.id ?? profile.sub)?.toString();
  if (!accountId) {
    throw new Error("Could not determine provider user ID");
  }

  const email = profile.email?.toLowerCase();
  const name = profile.name ?? profile.login;
  const image = profile.picture ?? profile.avatar_url;
  const accessTokenExpiresAt = tokens.expires_in
    ? Date.now() + tokens.expires_in * 1000
    : undefined;

  const result = await ctx.runMutation(
    internal.providers.oauth.finalizeCallback,
    {
      providerId: provider.id,
      accountId,
      email,
      name,
      image,
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
    redirectUrl: stateRecord.redirectUrl,
  };
}

/** Store OAuth state and code verifier for PKCE flow. */
export const storeOAuthState = internalMutation({
  args: {
    stateHash: v.string(),
    codeVerifier: v.string(),
    provider: v.string(),
    redirectUrl: v.optional(v.string()),
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

/**
 * Initiate an OAuth authorization flow.
 * Returns the authorization URL with PKCE + state parameters.
 */
export const getAuthorizationUrl = internalAction({
  args: {
    provider: oauthProviderConfigValidator,
    redirectUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) =>
    await getAuthorizationUrlForProvider(ctx, {
      provider: args.provider as OAuthProviderConfig,
      redirectUrl: args.redirectUrl,
    }),
});

export const finalizeCallback = internalMutation({
  args: {
    providerId: v.string(),
    accountId: v.string(),
    email: v.optional(v.string()),
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
      const existingUser = args.email
        ? await findUserByEmail(ctx.db, args.email)
        : null;

      if (!existingUser && args.email) {
        userId = await insertUser(ctx.db, {
          email: args.email,
          emailVerified: true,
          name: args.name,
          image: args.image,
          role: args.defaultRole,
        });
      } else if (existingUser) {
        userId = existingUser._id;
        await patchUser(ctx.db, existingUser._id, {
          emailVerified: true,
          name: args.name ?? existingUser.name,
          image: args.image ?? existingUser.image,
        });
      } else {
        throw new Error("OAuth provider did not return an email address");
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
      redirectUrl: args.redirectUrl,
      ipAddress: args.ipAddress,
      userAgent: args.userAgent,
      defaultRole: args.defaultRole,
    }),
});
