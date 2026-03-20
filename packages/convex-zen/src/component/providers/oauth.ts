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
import {
  requireOAuthVerifiedEmail,
  resolveOAuthProviderRuntime,
} from "../../oauth/providers";
import type {
  OAuthCallbackResult,
  OAuthProviderConfig,
  OAuthStartOptions,
  OAuthStartResult,
} from "../../types";
import {
  findAccount,
  findUserByEmail,
  findUserById,
  getAdminStateForUser,
  isAdminStateCurrentlyBanned,
  insertAccount,
  insertUser,
  patchAccount,
  patchUser,
  upsertAdminStateForUser,
} from "../core/users";
import { createSession } from "../core/sessions";

/** OAuth state TTL: 10 minutes. */
const STATE_TTL_MS = 10 * 60 * 1000;

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

function resolveCallbackUrl(
  options: Pick<OAuthStartOptions, "callbackUrl" | "redirectUrl"> | undefined
): string | undefined {
  return options?.callbackUrl ?? options?.redirectUrl;
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
  // Decode URL-encoded characters and re-validate to prevent bypasses such as
  // `/%2Fevil.com` which decodes to `//evil.com` (an open redirect).
  let decoded: string;
  try {
    decoded = decodeURIComponent(target);
  } catch {
    throw new Error(
      `${fieldName} contains invalid URL encoding`
    );
  }
  if (!decoded.startsWith("/") || decoded.startsWith("//")) {
    throw new Error(
      `${fieldName} must be a relative path that stays on the current origin`
    );
  }
  // Block backslash-based open-redirect tricks. Some browsers normalise `/\`
  // or `/\/` to `//` when resolving URLs, so we reject any backslash within
  // the first three characters of the decoded path (e.g. `/\`, `/\\`, `/\/`).
  if (decoded.substring(0, 3).includes("\\")) {
    throw new Error(
      `${fieldName} must be a relative path that stays on the current origin`
    );
  }
}

function providerTrustsVerifiedEmail(
  provider: OAuthProviderConfig
): boolean {
  return provider.trustVerifiedEmail === true;
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
  const runtime = resolveOAuthProviderRuntime(provider);
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
    authorizationUrl: runtime.buildAuthorizationUrl(provider, {
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
    redirectTo?: string;
    errorRedirectTo?: string;
    redirectUrl?: string;
    ipAddress?: string;
    userAgent?: string;
    defaultRole?: string;
  }
): Promise<OAuthCallbackResult> {
  const provider = args.provider;
  const runtime = resolveOAuthProviderRuntime(provider);

  assertRelativeRedirectTarget(args.redirectTo, "redirectTo");
  assertRelativeRedirectTarget(args.errorRedirectTo, "errorRedirectTo");

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

  const tokens = (await runtime.exchangeAuthorizationCode(provider, {
    code: args.code,
    codeVerifier: stateRecord.codeVerifier,
    callbackUrl,
  })) as OAuthTokenResponse;

  const tokenEncryptionSecret =
    provider.tokenEncryptionSecret?.trim() || provider.clientSecret;
  const encryptedAccessToken = await encryptString(
    tokens.accessToken,
    tokenEncryptionSecret
  );
  const encryptedRefreshToken = tokens.refreshToken
    ? await encryptString(tokens.refreshToken, tokenEncryptionSecret)
    : undefined;

  const profile = await runtime.fetchProfile(provider, tokens);
  const existingLinkedAccount = await ctx.runQuery(
    internal.core.users.getAccount,
    {
      providerId: provider.id,
      accountId: profile.accountId,
    }
  );

  const email = providerTrustsVerifiedEmail(provider)
    ? (runtime.requireVerifiedEmail?.(profile, provider) ??
      requireOAuthVerifiedEmail(profile))
    : undefined;

  if (!existingLinkedAccount && email === undefined) {
    throw new Error(
      "OAuth provider is not configured for trusted email linking. Link this provider to an existing account before signing in."
    );
  }

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
    redirectTo: args.redirectTo ?? stateRecord.redirectTo,
    redirectUrl:
      args.redirectTo ?? args.redirectUrl ?? stateRecord.redirectTo,
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
      if (!args.email) {
        throw new Error(
          "OAuth provider is not configured for trusted email linking. Link this provider to an existing account before signing in."
        );
      }
      const existingUser = await findUserByEmail(ctx.db, args.email);

      if (!existingUser) {
        userId = await insertUser(ctx.db, {
          email: args.email,
          emailVerified: true,
          name: args.name,
          image: args.image,
        });
        if (args.defaultRole !== undefined) {
          await upsertAdminStateForUser(ctx.db, userId, { role: args.defaultRole });
        }
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
    const adminState = user
      ? await getAdminStateForUser(ctx.db, user._id)
      : null;
    if (adminState && isAdminStateCurrentlyBanned(adminState, Date.now())) {
        throw new Error(
          `Account banned${adminState.banReason ? ": " + adminState.banReason : ""}`
        );
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
