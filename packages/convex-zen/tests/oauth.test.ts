import { convexTest } from "convex-test";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import schema from "../src/component/schema";
import { internal } from "../src/component/_generated/api";
import { googleProvider, githubProvider } from "../src/client/providers";

const modules = import.meta.glob("../src/component/**/*.*s");

const googleConfig = googleProvider({
  clientId: "test-client-id",
  clientSecret: "test-client-secret",
});

const githubConfig = githubProvider({
  clientId: "gh-client-id",
  clientSecret: "gh-client-secret",
});

/** Mock global fetch for OAuth HTTP calls. */
function mockFetch(profile: {
  id?: string;
  sub?: string;
  email?: string;
  name?: string;
  picture?: string;
  avatar_url?: string;
  login?: string;
}) {
  const mockFn = vi.fn().mockImplementation((url: string) => {
    const tokenUrls = [
      "https://oauth2.googleapis.com/token",
      "https://github.com/login/oauth/access_token",
    ];
    if (tokenUrls.some((u) => url.startsWith(u))) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            access_token: "mock-access-token",
            refresh_token: "mock-refresh-token",
            expires_in: 3600,
          }),
      });
    }
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve(profile),
    });
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
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("getAuthorizationUrl", () => {
    it("generates authorization URL with state and PKCE", async () => {
      const t = convexTest(schema, modules);

      const result = (await t.action(
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

      await t.action(internal.providers.oauth.getAuthorizationUrl, {
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
        t.action(internal.providers.oauth.getAuthorizationUrl, {
          provider: googleConfig,
        }),
        t.action(internal.providers.oauth.getAuthorizationUrl, {
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
        t.action(internal.providers.oauth.getAuthorizationUrl, {
          provider: insecureProvider,
        })
      ).rejects.toThrow("OAuth provider URLs must use HTTPS");
    });
  });

  describe("handleCallback", () => {
    async function initiateOAuth(
      t: ReturnType<typeof convexTest>,
      provider = googleConfig
    ) {
      const result = (await t.action(
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
        await ctx.db.insert("users", {
          email: "banned@example.com",
          emailVerified: true,
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
  });
});
