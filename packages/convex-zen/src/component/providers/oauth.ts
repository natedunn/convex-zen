import { makeFunctionReference } from "convex/server";
import { v, type GenericId } from "convex/values";
import {
  internalAction,
  internalMutation,
  internalQuery,
  type ActionCtx,
  type MutationCtx,
  type DatabaseWriter,
} from "../_generated/server.js";
import {
  encryptString,
  generateCodeChallenge,
  generateCodeVerifier,
  generateToken,
  generateState,
  hashToken,
} from "../lib/crypto.js";
import { oauthProviderConfigValidator } from "../lib/validators.js";
import { omitUndefined } from "../lib/object.js";
import { scheduleCleanupAt } from "../lib/scheduler.js";
import {
  requireOAuthVerifiedEmail,
  resolveOAuthProviderRuntime,
} from "../../oauth/providers.js";
import type {
  OAuthCallbackResult,
  OAuthProxyCallbackResult,
  OAuthProxyExchangeInput,
  OAuthProxyExchangeResult,
  OAuthProviderConfig,
  OAuthStartOptions,
  OAuthStartResult,
} from "../../types.js";
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
} from "../core/users.js";

/** OAuth state TTL: 10 minutes. */
const STATE_TTL_MS = 10 * 60 * 1000;
/** OAuth proxy handoff TTL: 60 seconds. */
const PROXY_HANDOFF_TTL_MS = 60 * 1000;
const cleanupExpiredOAuthStatesRef = makeFunctionReference<"mutation">(
  "core/gateway:cleanupExpiredOAuthStates"
);
const cleanupExpiredOAuthProxyHandoffsRef = makeFunctionReference<"mutation">(
  "core/gateway:cleanupExpiredOAuthProxyHandoffs"
);
const consumeOAuthStateRef = makeFunctionReference<"mutation">(
  "core/gateway:consumeOAuthState"
);
const consumeOAuthProxyHandoffRef = makeFunctionReference<"mutation">(
  "core/gateway:consumeOAuthProxyHandoff"
);
const storeOAuthProxyHandoffRef = makeFunctionReference<"mutation">(
  "core/gateway:storeOAuthProxyHandoff"
);
const createSessionRef = makeFunctionReference<"mutation">(
  "core/gateway:createSessionForOAuth"
);
const assertUserNotBannedRef = makeFunctionReference<"mutation">(
  "core/gateway:assertUserNotBanned"
);
const getLinkedAccountRef = makeFunctionReference<"query">(
  "core/gateway:getLinkedAccount"
);
const finalizeOAuthIdentityRef = makeFunctionReference<"mutation">(
  "core/gateway:finalizeOAuthIdentity"
);

type StoredOAuthStateRecord = {
  _id: GenericId<"oauthStates">;
  provider: string;
  codeVerifier: string;
  returnTarget?: string;
  proxyMode?: "direct" | "broker";
  redirectUrl?: string;
  callbackUrl?: string;
  redirectTo?: string;
  errorRedirectTo?: string;
  expiresAt: number;
};

type StoredOAuthProxyHandoffRecord = {
  _id: GenericId<"oauthProxyHandoffs">;
  userId: GenericId<"users">;
  provider: string;
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
    returnTarget?: string;
    proxyMode?: "direct" | "broker";
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
    returnTarget?: string;
    proxyMode?: "direct" | "broker";
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
  if (args.returnTarget !== undefined) {
    oauthStateDoc.returnTarget = args.returnTarget;
  }
  if (args.proxyMode !== undefined) {
    oauthStateDoc.proxyMode = args.proxyMode;
  }
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

export async function storeOAuthProxyHandoffRecord(
  db: DatabaseWriter,
  args: {
    codeHash: string;
    userId: GenericId<"users">;
    provider: string;
    redirectTo?: string;
    errorRedirectTo?: string;
    expiresAt: number;
  }
): Promise<void> {
  const now = Date.now();
  const oauthProxyHandoffDoc: {
    codeHash: string;
    userId: GenericId<"users">;
    provider: string;
    redirectTo?: string;
    errorRedirectTo?: string;
    expiresAt: number;
    createdAt: number;
  } = {
    codeHash: args.codeHash,
    userId: args.userId,
    provider: args.provider,
    expiresAt: args.expiresAt,
    createdAt: now,
  };
  if (args.redirectTo !== undefined) {
    oauthProxyHandoffDoc.redirectTo = args.redirectTo;
  }
  if (args.errorRedirectTo !== undefined) {
    oauthProxyHandoffDoc.errorRedirectTo = args.errorRedirectTo;
  }
  await db.insert("oauthProxyHandoffs", oauthProxyHandoffDoc);
}

export async function consumeOAuthProxyHandoffRecord(
  db: DatabaseWriter,
  codeHash: string
): Promise<StoredOAuthProxyHandoffRecord | null> {
  const record = await db
    .query("oauthProxyHandoffs")
    .withIndex("by_codeHash", (q) => q.eq("codeHash", codeHash))
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

export async function cleanupExpiredOAuthProxyHandoffs(
  db: DatabaseWriter
): Promise<void> {
  const now = Date.now();
  const expired = await db
    .query("oauthProxyHandoffs")
    .withIndex("by_expiresAt", (q) => q.lt("expiresAt", now))
    .take(100);
  for (const handoff of expired) {
    await db.delete(handoff._id);
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
    ...omitUndefined({
      returnTarget: args.options?.returnTarget,
      proxyMode: args.options?.proxyMode,
      redirectUrl: args.options?.redirectUrl,
      callbackUrl,
      redirectTo: args.options?.redirectTo,
      errorRedirectTo: args.options?.errorRedirectTo,
    }),
    expiresAt,
  });
  await scheduleCleanupAt(
    ctx.scheduler,
    expiresAt,
    cleanupExpiredOAuthStatesRef
  );

  return {
    authorizationUrl: runtime.buildAuthorizationUrl(
      provider,
      omitUndefined({
        state,
        codeChallenge,
        callbackUrl,
      })
    ),
  };
}

async function resolveOAuthCallbackIdentity(
  ctx: ActionCtx,
  args: {
    provider: OAuthProviderConfig;
    code: string;
    state: string;
    callbackUrl?: string;
    redirectTo?: string;
    errorRedirectTo?: string;
    redirectUrl?: string;
    defaultRole?: string;
  }
): Promise<{
  stateRecord: StoredOAuthStateRecord;
  userId: GenericId<"users">;
}> {
  const provider = args.provider;
  const runtime = resolveOAuthProviderRuntime(provider);

  assertRelativeRedirectTarget(args.redirectTo, "redirectTo");
  assertRelativeRedirectTarget(args.errorRedirectTo, "errorRedirectTo");

  const stateHash = await hashToken(args.state);
  const stateRecord = await ctx.runMutation(consumeOAuthStateRef, { stateHash });

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
  const existingLinkedAccount = await ctx.runQuery(getLinkedAccountRef, {
    providerId: provider.id,
    accountId: profile.accountId,
  });

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

  const result = await ctx.runMutation(finalizeOAuthIdentityRef, {
    providerId: provider.id,
    accountId: profile.accountId,
    email,
    name: profile.name,
    image: profile.image,
    encryptedAccessToken,
    ...omitUndefined({
      encryptedRefreshToken,
      accessTokenExpiresAt,
      defaultRole: args.defaultRole,
    }),
  });

  return {
    stateRecord,
    userId: result.userId,
  };
}

export async function assertUserNotBanned(
  db: DatabaseWriter,
  userId: GenericId<"users">
): Promise<void> {
  const user = await findUserById(db, userId);
  const adminState = user ? await getAdminStateForUser(db, user._id) : null;
  if (adminState && isAdminStateCurrentlyBanned(adminState, Date.now())) {
    throw new Error(
      `Account banned${adminState.banReason ? ": " + adminState.banReason : ""}`
    );
  }
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
    checkBanned?: boolean;
  }
): Promise<OAuthCallbackResult> {
  const { stateRecord, userId } = await resolveOAuthCallbackIdentity(ctx, args);

  if (args.checkBanned) {
    await ctx.runMutation(assertUserNotBannedRef, { userId });
  }

  const sessionToken = (await ctx.runMutation(createSessionRef, {
    userId,
    ...omitUndefined({
      ipAddress: args.ipAddress,
      userAgent: args.userAgent,
    }),
  })) as string;

  return omitUndefined({
    sessionToken,
    userId,
    redirectTo: args.redirectTo ?? stateRecord.redirectTo,
    redirectUrl:
      args.redirectTo ?? args.redirectUrl ?? stateRecord.redirectTo,
  }) as OAuthCallbackResult;
}

export async function handleOAuthProxyCallbackForProvider(
  ctx: ActionCtx,
  args: {
    provider: OAuthProviderConfig;
    code: string;
    state: string;
    callbackUrl?: string;
    redirectTo?: string;
    errorRedirectTo?: string;
    redirectUrl?: string;
    defaultRole?: string;
  }
): Promise<OAuthProxyCallbackResult> {
  const { stateRecord, userId } = await resolveOAuthCallbackIdentity(ctx, args);
  const handoffCode = generateToken();
  const handoffCodeHash = await hashToken(handoffCode);
  const expiresAt = Date.now() + PROXY_HANDOFF_TTL_MS;

  await ctx.runMutation(storeOAuthProxyHandoffRef, {
    codeHash: handoffCodeHash,
    userId,
    provider: args.provider.id,
    ...omitUndefined({
      redirectTo: args.redirectTo ?? stateRecord.redirectTo,
      errorRedirectTo: args.errorRedirectTo ?? stateRecord.errorRedirectTo,
    }),
    expiresAt,
  });
  await scheduleCleanupAt(
    ctx.scheduler,
    expiresAt,
    cleanupExpiredOAuthProxyHandoffsRef
  );

  return omitUndefined({
    code: handoffCode,
    userId,
    redirectTo: args.redirectTo ?? stateRecord.redirectTo,
  }) as OAuthProxyCallbackResult;
}

export async function exchangeOAuthProxyCodeForSession(
  ctx: ActionCtx,
  args: OAuthProxyExchangeInput & {
    checkBanned?: boolean;
  }
): Promise<OAuthProxyExchangeResult> {
  const codeHash = await hashToken(args.code);
  const handoff = await ctx.runMutation(consumeOAuthProxyHandoffRef, {
    codeHash,
  });
  if (!handoff) {
    throw new Error("Invalid or expired OAuth proxy code");
  }

  if (args.checkBanned) {
    await ctx.runMutation(assertUserNotBannedRef, { userId: handoff.userId });
  }

  const sessionToken = (await ctx.runMutation(createSessionRef, {
    userId: handoff.userId,
    ...omitUndefined({
      ipAddress: args.ipAddress,
      userAgent: args.userAgent,
    }),
  })) as string;

  return omitUndefined({
    sessionToken,
    userId: handoff.userId,
    redirectTo: handoff.redirectTo,
  }) as OAuthProxyExchangeResult;
}

/** Retrieve and delete an OAuth state record by state hash (single-use). */
export const consumeOAuthState = internalMutation({
  args: { stateHash: v.string() },
  handler: async (ctx, { stateHash }) => {
    return await consumeOAuthStateRecord(ctx.db, stateHash);
  },
});

export const consumeOAuthProxyHandoff = internalMutation({
  args: { codeHash: v.string() },
  handler: async (ctx, { codeHash }) =>
    await consumeOAuthProxyHandoffRecord(ctx.db, codeHash),
});

export const storeOAuthProxyHandoff = internalMutation({
  args: {
    codeHash: v.string(),
    userId: v.id("users"),
    provider: v.string(),
    redirectTo: v.optional(v.string()),
    errorRedirectTo: v.optional(v.string()),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => await storeOAuthProxyHandoffRecord(ctx.db, args),
});

/** Resolve an existing OAuth-linked account through the root component API. */
export const getLinkedAccount = internalQuery({
  args: {
    providerId: v.string(),
    accountId: v.string(),
  },
  handler: async (ctx, { providerId, accountId }) =>
    await findAccount(ctx.db, providerId, accountId),
});

/** Cleanup expired OAuth state rows (intended to be scheduled). */
export const cleanup = internalMutation({
  args: {},
  handler: async (ctx) => await cleanupExpiredOAuthStates(ctx.db),
});

export const cleanupProxyHandoffs = internalMutation({
  args: {},
  handler: async (ctx) => await cleanupExpiredOAuthProxyHandoffs(ctx.db),
});

/**
 * Initiate an OAuth authorization flow.
 * Returns the authorization URL with PKCE + state parameters.
 */
export const getAuthorizationUrl = internalMutation({
  args: {
    provider: oauthProviderConfigValidator,
    callbackUrl: v.optional(v.string()),
    returnTarget: v.optional(v.string()),
    proxyMode: v.optional(v.union(v.literal("direct"), v.literal("broker"))),
    redirectTo: v.optional(v.string()),
    errorRedirectTo: v.optional(v.string()),
    redirectUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) =>
    await getAuthorizationUrlForProvider(ctx, {
      provider: args.provider as OAuthProviderConfig,
      options: omitUndefined({
        callbackUrl: args.callbackUrl,
        returnTarget: args.returnTarget,
        proxyMode: args.proxyMode,
        redirectTo: args.redirectTo,
        errorRedirectTo: args.errorRedirectTo,
        redirectUrl: args.redirectUrl,
      }),
    }),
});

export async function finalizeOAuthIdentityForProvider(
  ctx: Pick<MutationCtx, "db">,
  args: {
    providerId: string;
    accountId: string;
    email?: string;
    name?: string;
    image?: string;
    encryptedAccessToken: string;
    encryptedRefreshToken?: string;
    accessTokenExpiresAt?: number;
    defaultRole?: string;
  }
) {
  const existingAccount = await findAccount(
    ctx.db,
    args.providerId,
    args.accountId
  );

  let userId: GenericId<"users">;

  if (existingAccount) {
    await patchAccount(ctx.db, existingAccount._id, {
      accessToken: args.encryptedAccessToken,
      ...omitUndefined({
        refreshToken: args.encryptedRefreshToken,
        accessTokenExpiresAt: args.accessTokenExpiresAt,
      }),
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
        ...omitUndefined({
          name: args.name,
          image: args.image,
        }),
      });
      if (args.defaultRole !== undefined) {
        await upsertAdminStateForUser(ctx.db, userId, { role: args.defaultRole });
      }
    } else {
      userId = existingUser._id;
      await patchUser(ctx.db, existingUser._id, {
        emailVerified: true,
        ...omitUndefined({
          name: existingUser.name ?? args.name,
          image: existingUser.image ?? args.image,
        }),
      });
    }

    await insertAccount(ctx.db, {
      userId,
      providerId: args.providerId,
      accountId: args.accountId,
      accessToken: args.encryptedAccessToken,
      ...omitUndefined({
        refreshToken: args.encryptedRefreshToken,
        accessTokenExpiresAt: args.accessTokenExpiresAt,
      }),
    });
  }

  return {
    userId,
  };
}

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
    redirectTo: v.optional(v.string()),
    errorRedirectTo: v.optional(v.string()),
    redirectUrl: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    defaultRole: v.optional(v.string()),
    checkBanned: v.optional(v.boolean()),
  },
  handler: async (ctx, args) =>
    await handleOAuthCallbackForProvider(ctx, {
      provider: args.provider as OAuthProviderConfig,
      code: args.code,
      state: args.state,
      ...omitUndefined({
        callbackUrl: args.callbackUrl,
        redirectTo: args.redirectTo,
        errorRedirectTo: args.errorRedirectTo,
        redirectUrl: args.redirectUrl,
        ipAddress: args.ipAddress,
        userAgent: args.userAgent,
        defaultRole: args.defaultRole,
        checkBanned: args.checkBanned,
      }),
    }),
});

export const handleProxyCallback = internalAction({
  args: {
    provider: oauthProviderConfigValidator,
    code: v.string(),
    state: v.string(),
    callbackUrl: v.optional(v.string()),
    redirectTo: v.optional(v.string()),
    errorRedirectTo: v.optional(v.string()),
    redirectUrl: v.optional(v.string()),
    defaultRole: v.optional(v.string()),
  },
  handler: async (ctx, args) =>
    await handleOAuthProxyCallbackForProvider(ctx, {
      provider: args.provider as OAuthProviderConfig,
      code: args.code,
      state: args.state,
      ...omitUndefined({
        callbackUrl: args.callbackUrl,
        redirectTo: args.redirectTo,
        errorRedirectTo: args.errorRedirectTo,
        redirectUrl: args.redirectUrl,
        defaultRole: args.defaultRole,
      }),
    }),
});

export const exchangeProxyCode = internalAction({
  args: {
    code: v.string(),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    checkBanned: v.optional(v.boolean()),
  },
  handler: async (ctx, args) =>
    await exchangeOAuthProxyCodeForSession(ctx, args),
});
