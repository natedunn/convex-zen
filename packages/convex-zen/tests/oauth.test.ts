import { convexTest } from "convex-test";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import schema from "../src/component/schema";
import { internal } from "../src/component/_generated/api";
import {
  buildOAuthAuthorizationUrl,
  defineOAuthProvider,
  discordProvider,
  exchangeOAuthAuthorizationCode,
  githubProvider,
  googleProvider,
  requireOAuthVerifiedEmail,
} from "../src/client/providers";
import type { OAuthProviderConfig } from "../src/types";

const modules = import.meta.glob("../src/component/**/*.*s");

const googleConfig = googleProvider({
  clientId: "test-client-id",
  clientSecret: "test-client-secret",
});

const githubConfig = githubProvider({
  clientId: "gh-client-id",
  clientSecret: "gh-client-secret",
});

const discordConfig = discordProvider({
  clientId: "discord-client-id",
  clientSecret: "discord-client-secret",
});

const acmeProvider = defineOAuthProvider<
  { clientId: string; clientSecret: string; tenant: string },
  OAuthProviderConfig
>({
  id: "acme",
  createConfig: (config) => ({
    id: "acme",
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    trustVerifiedEmail: true,
    authorizationUrl: "https://acme.example/oauth/authorize",
    tokenUrl: "https://acme.example/oauth/token",
    userInfoUrl: "https://acme.example/api/me",
    scopes: ["profile", "email"],
    runtimeConfig: {
      tenant: config.tenant,
    },
  }),
  runtime: {
    buildAuthorizationUrl: (provider, args) =>
      buildOAuthAuthorizationUrl(provider, {
        ...args,
        authorizationParams: {
          tenant:
            typeof (provider.runtimeConfig as { tenant?: unknown } | undefined)
              ?.tenant === "string"
              ? ((provider.runtimeConfig as { tenant: string }).tenant as string)
              : undefined,
        },
      }),
    exchangeAuthorizationCode: async (provider, args) =>
      await exchangeOAuthAuthorizationCode(provider, args),
    fetchProfile: async (provider, tokens) => {
      const tenant =
        typeof (provider.runtimeConfig as { tenant?: unknown } | undefined)
          ?.tenant === "string"
          ? ((provider.runtimeConfig as { tenant: string }).tenant as string)
          : undefined;
      const response = await fetch(provider.userInfoUrl, {
        headers: {
          Authorization: `Bearer ${tokens.accessToken}`,
          ...(tenant ? { "X-Tenant": tenant } : {}),
        },
      });
      if (!response.ok) {
        throw new Error(`User info fetch failed: ${response.status}`);
      }
      const profile = (await response.json()) as {
        id?: string;
        email?: string;
        verified_email?: boolean;
        display_name?: string;
        avatar_url?: string;
      };
      if (!profile.id) {
        throw new Error("Could not determine provider user ID");
      }
      return {
        accountId: profile.id,
        email: profile.email,
        emailVerified: profile.verified_email === true,
        name: profile.display_name,
        image: profile.avatar_url,
      };
    },
    requireVerifiedEmail: (profile) => requireOAuthVerifiedEmail(profile),
  },
});

const acmeConfig = acmeProvider({
  clientId: "acme-client-id",
  clientSecret: "acme-client-secret",
  tenant: "workspace-1",
});

const acmeUntrustedProvider = defineOAuthProvider<
  { clientId: string; clientSecret: string },
  OAuthProviderConfig
>({
  id: "acme-untrusted",
  createConfig: (config) => ({
    id: "acme-untrusted",
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    authorizationUrl: "https://acme.example/oauth/authorize",
    tokenUrl: "https://acme.example/oauth/token",
    userInfoUrl: "https://acme.example/api/me",
    scopes: ["profile", "email"],
  }),
  runtime: {
    buildAuthorizationUrl: (provider, args) =>
      buildOAuthAuthorizationUrl(provider, args),
    exchangeAuthorizationCode: async (provider, args) =>
      await exchangeOAuthAuthorizationCode(provider, args),
    fetchProfile: async () => ({
      accountId: "acme-untrusted-user",
      email: "oauth@example.com",
      emailVerified: true,
      name: "Acme User",
    }),
  },
});

const acmeUntrustedConfig = acmeUntrustedProvider({
  clientId: "acme-untrusted-client-id",
  clientSecret: "acme-untrusted-client-secret",
});

function createJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
  });
}

/** Mock global fetch for OAuth HTTP calls. */
function mockFetch(profile: {
  id?: string;
  sub?: string;
  email?: string;
  name?: string;
  picture?: string;
  avatar_url?: string;
  login?: string;
  global_name?: string;
  username?: string;
  avatar?: string;
  discriminator?: string;
  email_verified?: boolean;
  verified?: boolean;
}) {
  const mockFn = vi.fn().mockImplementation((input: string | URL | Request) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    const tokenUrls = [
      "https://oauth2.googleapis.com/token",
      "https://github.com/login/oauth/access_token",
      "https://discord.com/api/oauth2/token",
      "https://acme.example/oauth/token",
    ];
    if (tokenUrls.some((u) => url.startsWith(u))) {
      return Promise.resolve(
        createJsonResponse({
          access_token: "mock-access-token",
          refresh_token: "mock-refresh-token",
          expires_in: 3600,
        })
      );
    }

    if (url.startsWith("https://api.github.com/user/emails")) {
      return Promise.resolve(
        createJsonResponse([
          {
            email: profile.email,
            primary: true,
            verified: profile.verified ?? true,
          },
        ])
      );
    }

    if (url.startsWith("https://api.github.com/user")) {
      return Promise.resolve(createJsonResponse(profile));
    }

    if (url.startsWith("https://discord.com/api/users/@me")) {
      return Promise.resolve(
        createJsonResponse({
          ...profile,
          verified: profile.verified ?? true,
        })
      );
    }

    return Promise.resolve(
      createJsonResponse({
        ...profile,
        email_verified: profile.email_verified ?? true,
      })
    );
  });

  vi.spyOn(globalThis, "fetch").mockImplementation(
    mockFn as unknown as typeof fetch
  );

  return mockFn;
}

describe("oauth", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("getAuthorizationUrl", () => {
    it("generates authorization URL with state and PKCE", async () => {
      const t = convexTest(schema, modules);

      const result = (await t.mutation(
        internal.providers.oauth.getAuthorizationUrl,
        {
          provider: googleConfig,
          redirectUrl: "https://example.com/auth/callback/google",
        }
      )) as { authorizationUrl: string };

      const url = new URL(result.authorizationUrl);

      expect(url.hostname).toBe("accounts.google.com");
      expect(url.searchParams.get("client_id")).toBe("test-client-id");
      expect(url.searchParams.get("response_type")).toBe("code");
      expect(url.searchParams.get("code_challenge_method")).toBe("S256");
      expect(url.searchParams.get("state")).toBeTruthy();
      expect(url.searchParams.get("code_challenge")).toBeTruthy();
    });

    it("stores oauth state in database", async () => {
      const t = convexTest(schema, modules);

      await t.mutation(internal.providers.oauth.getAuthorizationUrl, {
        provider: googleConfig,
      });

      const states = await t.run(async (ctx) => {
        return ctx.db.query("oauthStates").collect();
      });

      expect(states).toHaveLength(1);
      expect(states[0]!.provider).toBe("google");
      expect(states[0]!.stateHash).toBeTruthy();
      expect(states[0]!.codeVerifier).toBeTruthy();
    });

    it("generates unique state per request", async () => {
      const t = convexTest(schema, modules);

      const [r1, r2] = (await Promise.all([
        t.mutation(internal.providers.oauth.getAuthorizationUrl, {
          provider: googleConfig,
        }),
        t.mutation(internal.providers.oauth.getAuthorizationUrl, {
          provider: googleConfig,
        }),
      ])) as [{ authorizationUrl: string }, { authorizationUrl: string }];

      const state1 = new URL(r1.authorizationUrl).searchParams.get("state");
      const state2 = new URL(r2.authorizationUrl).searchParams.get("state");

      expect(state1).not.toBe(state2);
    });

    it("rejects provider config with non-HTTPS URLs", async () => {
      const t = convexTest(schema, modules);
      const insecureProvider = {
        ...googleConfig,
        tokenUrl: "http://oauth2.googleapis.com/token",
      };

      await expect(
        t.mutation(internal.providers.oauth.getAuthorizationUrl, {
          provider: insecureProvider,
        })
      ).rejects.toThrow("OAuth provider URLs must use HTTPS");
    });

    it("rejects non-relative redirect targets", async () => {
      const t = convexTest(schema, modules);

      await expect(
        t.mutation(internal.providers.oauth.getAuthorizationUrl, {
          provider: googleConfig,
          redirectTo: "https://evil.example/steal",
        })
      ).rejects.toThrow("redirectTo must be a relative path");
    });

    it("rejects URL-encoded open-redirect bypass in redirectTo", async () => {
      const t = convexTest(schema, modules);

      // /%2Fevil.com decodes to //evil.com which is a protocol-relative URL
      // (open redirect). The validator must catch this after decoding.
      await expect(
        t.mutation(internal.providers.oauth.getAuthorizationUrl, {
          provider: googleConfig,
          redirectTo: "/%2Fevil.com/path",
        })
      ).rejects.toThrow("redirectTo must be a relative path");
    });

    it("rejects backslash open-redirect bypass in redirectTo", async () => {
      const t = convexTest(schema, modules);

      // /\evil.com is treated as //evil.com by some browsers/parsers
      await expect(
        t.mutation(internal.providers.oauth.getAuthorizationUrl, {
          provider: googleConfig,
          redirectTo: "/\\evil.com",
        })
      ).rejects.toThrow("redirectTo must be a relative path");
    });

    it("cleans up expired oauth states", async () => {
      const t = convexTest(schema, modules);

      await t.mutation(internal.providers.oauth.getAuthorizationUrl, {
        provider: googleConfig,
      });

      vi.advanceTimersByTime(11 * 60 * 1000);

      await t.mutation(internal.providers.oauth.cleanup, {});

      const states = await t.run(async (ctx) => ctx.db.query("oauthStates").collect());
      expect(states).toHaveLength(0);
    });
  });

  describe("handleCallback", () => {
    async function initiateOAuth(
      t: ReturnType<typeof convexTest>,
      provider = googleConfig
    ) {
      const result = (await t.mutation(
        internal.providers.oauth.getAuthorizationUrl,
        { provider }
      )) as { authorizationUrl: string };

      const state = new URL(result.authorizationUrl).searchParams.get(
        "state"
      )!;
      return { state };
    }

    it("creates new user and session on first OAuth login", async () => {
      const t = convexTest(schema, modules);
      const { state } = await initiateOAuth(t);

      mockFetch({
        sub: "google-uid-123",
        email: "oauth@example.com",
        name: "OAuth User",
        picture: "https://example.com/photo.jpg",
      });

      const result = (await t.action(internal.providers.oauth.handleCallback, {
        provider: googleConfig,
        code: "auth-code-123",
        state,
      })) as { sessionToken: string; userId: string };

      expect(result.sessionToken).toBeTruthy();
      expect(result.userId).toBeTruthy();

      const user = await t.run(async (ctx) => {
        return ctx.db
          .query("users")
          .withIndex("by_email", (q) => q.eq("email", "oauth@example.com"))
          .unique();
      });
      expect(user).not.toBeNull();
      expect(user!.emailVerified).toBe(true);

      const account = await t.run(async (ctx) => {
        return ctx.db
          .query("accounts")
          .withIndex("by_provider_accountId", (q) =>
            q.eq("providerId", "google").eq("accountId", "google-uid-123")
          )
          .unique();
      });
      expect(account).not.toBeNull();
      expect(account!.accessToken).toBeTruthy();
      expect(account!.accessToken).not.toBe("mock-access-token");
      expect(account!.accessToken!.startsWith("enc:v1:")).toBe(true);
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "https://www.googleapis.com/oauth2/v3/userinfo",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer mock-access-token",
          }),
        })
      );
    });

    it("reuses existing account on subsequent login", async () => {
      const t = convexTest(schema, modules);

      mockFetch({
        sub: "google-uid-456",
        email: "returning@example.com",
        name: "Returning User",
      });

      // First login
      const { state: state1 } = await initiateOAuth(t);
      const first = (await t.action(internal.providers.oauth.handleCallback, {
        provider: googleConfig,
        code: "code1",
        state: state1,
      })) as { userId: string };

      // Second login
      const { state: state2 } = await initiateOAuth(t);
      const second = (await t.action(internal.providers.oauth.handleCallback, {
        provider: googleConfig,
        code: "code2",
        state: state2,
      })) as { userId: string };

      // Same user
      expect(first.userId).toBe(second.userId);

      const users = await t.run(async (ctx) => ctx.db.query("users").collect());
      expect(users).toHaveLength(1);
    });

    it("links OAuth account to existing email/password account", async () => {
      const t = convexTest(schema, modules);

      // Create existing user via email/password
      const existingUserId = await t.run(async (ctx) => {
        const id = await ctx.db.insert("users", {
          email: "existing@example.com",
          emailVerified: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        await ctx.db.insert("accounts", {
          userId: id,
          providerId: "credential",
          accountId: "existing@example.com",
          passwordHash: "hashedpw",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        return id;
      });

      // OAuth login with same email
      const { state } = await initiateOAuth(t);
      mockFetch({
        sub: "google-uid-789",
        email: "existing@example.com",
        name: "Existing User",
      });

      const result = (await t.action(internal.providers.oauth.handleCallback, {
        provider: googleConfig,
        code: "code",
        state,
      })) as { userId: string };

      // Should be linked to the existing user
      expect(result.userId).toBe(existingUserId);

      const users = await t.run(async (ctx) => ctx.db.query("users").collect());
      expect(users).toHaveLength(1);

      const accounts = await t.run(async (ctx) =>
        ctx.db.query("accounts").collect()
      );
      expect(accounts).toHaveLength(2);
    });

    it("rejects invalid state", async () => {
      const t = convexTest(schema, modules);

      mockFetch({ sub: "uid", email: "user@example.com" });

      await expect(
        t.action(internal.providers.oauth.handleCallback, {
          provider: googleConfig,
          code: "code",
          state: "invalid-state-that-does-not-exist",
        })
      ).rejects.toThrow("Invalid or expired OAuth state");
    });

    it("rejects expired state", async () => {
      const t = convexTest(schema, modules);

      const { state } = await initiateOAuth(t);

      // Advance past 10-minute TTL
      vi.advanceTimersByTime(11 * 60 * 1000);

      mockFetch({ sub: "uid", email: "user@example.com" });

      await expect(
        t.action(internal.providers.oauth.handleCallback, {
          provider: googleConfig,
          code: "code",
          state,
        })
      ).rejects.toThrow("Invalid or expired OAuth state");
    });

    it("state is single-use", async () => {
      const t = convexTest(schema, modules);

      const { state } = await initiateOAuth(t);
      mockFetch({ sub: "uid-single-use", email: "single@example.com" });

      // First use succeeds
      await t.action(internal.providers.oauth.handleCallback, {
        provider: googleConfig,
        code: "code1",
        state,
      });

      // Second use with same state fails
      await expect(
        t.action(internal.providers.oauth.handleCallback, {
          provider: googleConfig,
          code: "code2",
          state,
        })
      ).rejects.toThrow("Invalid or expired OAuth state");
    });

    it("rejects banned user OAuth login", async () => {
      const t = convexTest(schema, modules);

      await t.run(async (ctx) => {
        const userId = await ctx.db.insert("users", {
          email: "banned@example.com",
          emailVerified: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        await ctx.db.insert("systemAdmin__users", {
          userId,
          role: "user",
          banned: true,
          banReason: "Spammer",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const { state } = await initiateOAuth(t);
      mockFetch({ sub: "uid-banned", email: "banned@example.com" });

      await expect(
        t.action(internal.providers.oauth.handleCallback, {
          provider: googleConfig,
          code: "code",
          state,
          checkBanned: true,
        })
      ).rejects.toThrow("Account banned");
    });

    it("works with GitHub provider", async () => {
      const t = convexTest(schema, modules);

      const { state } = await initiateOAuth(t, githubConfig);
      mockFetch({
        id: "gh-12345",
        email: "ghuser@example.com",
        name: "GitHub User",
        avatar_url: "https://avatars.githubusercontent.com/u/12345",
        login: "ghuser",
      });

      const result = (await t.action(internal.providers.oauth.handleCallback, {
        provider: githubConfig,
        code: "gh-code",
        state,
      })) as { sessionToken: string };

      expect(result.sessionToken).toBeTruthy();
    });

    it("works with Discord provider", async () => {
      const t = convexTest(schema, modules);

      const { state } = await initiateOAuth(t, discordConfig);
      mockFetch({
        id: "discord-123",
        email: "discord@example.com",
        username: "discord-user",
        global_name: "Discord User",
        avatar: "avatarhash",
      });

      const result = (await t.action(internal.providers.oauth.handleCallback, {
        provider: discordConfig,
        code: "discord-code",
        state,
      })) as { sessionToken: string };

      expect(result.sessionToken).toBeTruthy();
    });

    it("rejects unverified provider email", async () => {
      const t = convexTest(schema, modules);
      const { state } = await initiateOAuth(t);

      mockFetch({
        sub: "google-unverified",
        email: "unverified@example.com",
        email_verified: false,
      });

      await expect(
        t.action(internal.providers.oauth.handleCallback, {
          provider: googleConfig,
          code: "code",
          state,
        })
      ).rejects.toThrow("verified email");
    });

    it("rejects callback provider config with empty scopes", async () => {
      const t = convexTest(schema, modules);
      const { state } = await initiateOAuth(t);
      const badProvider = {
        ...googleConfig,
        scopes: [],
      };

      await expect(
        t.action(internal.providers.oauth.handleCallback, {
          provider: badProvider,
          code: "code",
          state,
        })
      ).rejects.toThrow("OAuth provider scopes must not be empty");
    });

    it("supports custom providers through the shared runtime contract", async () => {
      const t = convexTest(schema, modules);
      const { state } = await initiateOAuth(t, acmeConfig);

      mockFetch({
        id: "acme-user-123",
        email: "acme@example.com",
        verified_email: true,
        display_name: "Acme User",
        avatar_url: "https://acme.example/avatar.png",
      });

      const result = (await t.action(internal.providers.oauth.handleCallback, {
        provider: acmeConfig,
        code: "acme-code",
        state,
      })) as { sessionToken: string; userId: string };

      expect(result.sessionToken).toBeTruthy();
      expect(result.userId).toBeTruthy();
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "https://acme.example/api/me",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer mock-access-token",
            "X-Tenant": "workspace-1",
          }),
        })
      );
    });

    it("requires custom providers to opt in before trusting verified email claims", async () => {
      const t = convexTest(schema, modules);
      const { state } = await initiateOAuth(t, acmeUntrustedConfig);
      mockFetch({
        id: "acme-untrusted-user",
        email: "oauth@example.com",
        verified_email: true,
        display_name: "Acme User",
      });

      await expect(
        t.action(internal.providers.oauth.handleCallback, {
          provider: acmeUntrustedConfig,
          code: "acme-code",
          state,
        })
      ).rejects.toThrow("trusted email linking");
    });
  });
});
