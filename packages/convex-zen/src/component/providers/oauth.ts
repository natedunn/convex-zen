import { v, type GenericId } from "convex/values";
import { internalAction, internalMutation, internalQuery } from "../_generated/server";
import {
  generateState,
  generateCodeVerifier,
  generateCodeChallenge,
  hashToken,
} from "../lib/crypto";
import { oauthProviderConfigValidator } from "../lib/validators";
import { internal } from "../lib/internalApi";
import type { OAuthProviderConfig } from "../../types";

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
    await ctx.db.insert("oauthStates", oauthStateDoc);
  },
});

/** Retrieve and delete an OAuth state record by state hash (single-use). */
export const consumeOAuthState = internalMutation({
  args: { stateHash: v.string() },
  handler: async (ctx, { stateHash }) => {
    const record = await ctx.db
      .query("oauthStates")
      .withIndex("by_stateHash", (q) => q.eq("stateHash", stateHash))
      .unique();

    if (!record) return null;

    // Delete immediately (single-use)
    await ctx.db.delete(record._id);

    if (record.expiresAt < Date.now()) {
      return null; // Expired
    }

    return record;
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
  handler: async (ctx, args) => {
    const provider = args.provider as OAuthProviderConfig;
    assertValidProviderConfig(provider);

    // Generate state (32 bytes = 256 bit)
    const state = generateState();
    const stateHash = await hashToken(state);

    // Generate PKCE code verifier and challenge
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

    // Build authorization URL
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
  },
  handler: async (ctx, args) => {
    const provider = args.provider as OAuthProviderConfig;
    assertValidProviderConfig(provider);
    // Use global fetch; tests can mock it via vi.spyOn(globalThis, 'fetch')
    const fetchFn = fetch;

    // 1. Validate state against stored stateHash
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

    // 2. Exchange code + code_verifier for tokens
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

    // 3. Fetch user profile from provider
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

    const providerId = provider.id;
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

    // 4. Find existing account or create user + account (account linking by email)
    const existingAccount = await ctx.runQuery(internal.core.users.getAccount, {
      providerId,
      accountId,
    });

    let userId: GenericId<"users">;

    if (existingAccount) {
      // Update tokens on existing account
      await ctx.runMutation(internal.core.users.updateAccount, {
        accountId: existingAccount._id,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        accessTokenExpiresAt,
      });
      userId = existingAccount.userId;
    } else {
      // Try to link by email
      const existingUser = email
        ? await ctx.runQuery(internal.core.users.getByEmail, { email })
        : null;

      if (!existingUser && email) {
        // Create new user
        userId = await ctx.runMutation(internal.core.users.create, {
          email,
          emailVerified: true, // OAuth providers verify email
          name,
          image,
        });
      } else if (existingUser) {
        userId = existingUser._id;
        // Update profile info from OAuth
        await ctx.runMutation(internal.core.users.update, {
          userId: existingUser._id,
          emailVerified: true,
          name: name ?? existingUser.name,
          image: image ?? existingUser.image,
        });
      } else {
        throw new Error("OAuth provider did not return an email address");
      }

      // Create account entry
      await ctx.runMutation(internal.core.users.createAccount, {
        userId,
        providerId,
        accountId,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        accessTokenExpiresAt,
      });
    }

    // 5. Check banned status
    const user = await ctx.runQuery(internal.core.users.getById, { userId });
    if (user?.banned) {
      const now = Date.now();
      if (user.banExpires === undefined || user.banExpires > now) {
        throw new Error(
          `Account banned${user.banReason ? ": " + user.banReason : ""}`
        );
      }
    }

    // 6. Create session
    const sessionToken = await ctx.runMutation(internal.core.sessions.create, {
      userId,
      ipAddress: args.ipAddress,
      userAgent: args.userAgent,
    });

    return {
      sessionToken,
      userId,
      redirectUrl: stateRecord.redirectUrl,
    };
  },
});
