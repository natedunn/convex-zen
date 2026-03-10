import { describe, expect, it, vi } from "vitest";
import type { FunctionReference } from "convex/server";
import {
  createExpoAuthClient,
  createKeyValueStorageAuthStorage,
  type ExpoAuthCoreMeta,
  type ExpoAuthPluginMeta,
} from "../src/client/expo";

const {
  convexClientInstances,
  MockConvexHttpClient,
  queryHandler,
  mutationHandler,
  actionHandler,
} = vi.hoisted(() => {
  const instances: Array<{
    url: string;
    setAuth: ReturnType<typeof vi.fn<(token: string) => void>>;
    clearAuth: ReturnType<typeof vi.fn<() => void>>;
    query: ReturnType<typeof vi.fn>;
    mutation: ReturnType<typeof vi.fn>;
    action: ReturnType<typeof vi.fn>;
  }> = [];

  const query = vi.fn(async () => ({ ok: true }));
  const mutation = vi.fn(async () => ({ ok: true }));
  const action = vi.fn(async () => ({ ok: true }));

  class HoistedMockConvexHttpClient {
    readonly url: string;
    readonly setAuth = vi.fn<(token: string) => void>();
    readonly clearAuth = vi.fn<() => void>();
    readonly query = vi.fn((...args: unknown[]) => query(...args));
    readonly mutation = vi.fn((...args: unknown[]) => mutation(...args));
    readonly action = vi.fn((...args: unknown[]) => action(...args));

    constructor(url: string) {
      this.url = url;
      instances.push(this);
    }
  }

  return {
    convexClientInstances: instances,
    MockConvexHttpClient: HoistedMockConvexHttpClient,
    queryHandler: query,
    mutationHandler: mutation,
    actionHandler: action,
  };
});

vi.mock("convex/browser", () => ({
  ConvexHttpClient: MockConvexHttpClient,
}));

function queryRef(name: string): FunctionReference<"query", "public"> {
  return { name } as unknown as FunctionReference<"query", "public">;
}

function mutationRef(name: string): FunctionReference<"mutation", "public"> {
  return { name } as unknown as FunctionReference<"mutation", "public">;
}

function actionRef(name: string): FunctionReference<"action", "public"> {
  return { name } as unknown as FunctionReference<"action", "public">;
}

function resetHandlers(): void {
  convexClientInstances.length = 0;
  queryHandler.mockReset();
  mutationHandler.mockReset();
  actionHandler.mockReset();
}

describe("createKeyValueStorageAuthStorage", () => {
  it("serializes auth payloads through an async key-value store", async () => {
    const backingStore = new Map<string, string>();
    const storage = createKeyValueStorageAuthStorage({
      getItem: async (key) => backingStore.get(key) ?? null,
      setItem: async (key, value) => {
        backingStore.set(key, value);
      },
      removeItem: async (key) => {
        backingStore.delete(key);
      },
    });

    await storage.set({
      token: "token_1",
      issuedAtMs: 123,
      expiresAtMs: 456,
    });

    await expect(storage.get()).resolves.toEqual({
      token: "token_1",
      issuedAtMs: 123,
      expiresAtMs: 456,
    });

    await storage.clear();
    await expect(storage.get()).resolves.toBeNull();
  });
});

describe("createExpoAuthClient", () => {
  it("signs in with email, persists the token, and resolves sessions", async () => {
    resetHandlers();

    const signInWithEmail = mutationRef("auth.core.signInWithEmail");
    const validateSession = mutationRef("auth.core.validateSession");
    const invalidateSession = mutationRef("auth.core.invalidateSession");

    mutationHandler.mockImplementation(async (fn: unknown, args: unknown) => {
      if (fn === signInWithEmail) {
        expect(args).toEqual({
          email: "hello@example.com",
          password: "password123",
        });
        return { sessionToken: "token_1", userId: "u1" };
      }
      if (fn === validateSession) {
        expect(args).toEqual({ token: "token_1" });
        return { userId: "u1", sessionId: "s1" };
      }
      if (fn === invalidateSession) {
        return null;
      }
      return { ok: true };
    });

    const backingStore = new Map<string, string>();
    const client = createExpoAuthClient({
      convexUrl: "https://example.convex.cloud",
      convexFunctions: {
        signInWithEmail,
        validateSession,
        invalidateSession,
      },
      runtime: {
        storage: createKeyValueStorageAuthStorage({
          getItem: async (key) => backingStore.get(key) ?? null,
          setItem: async (key, value) => {
            backingStore.set(key, value);
          },
          removeItem: async (key) => {
            backingStore.delete(key);
          },
        }),
      },
    });

    await expect(
      client.signIn.email({
        email: "hello@example.com",
        password: "password123",
      })
    ).resolves.toEqual({
      userId: "u1",
      sessionId: "s1",
    });

    await expect(client.getToken()).resolves.toBe("token_1");
    await expect(client.getSession()).resolves.toEqual({
      userId: "u1",
      sessionId: "s1",
    });
    expect(backingStore.get("convex-zen.auth.token")).toContain("token_1");
  });

  it("bridges convex auth and clears local state on sign-out", async () => {
    resetHandlers();

    const signInWithEmail = mutationRef("auth.core.signInWithEmail");
    const validateSession = mutationRef("auth.core.validateSession");
    const invalidateSession = mutationRef("auth.core.invalidateSession");

    let activeToken: string | null = null;
    mutationHandler.mockImplementation(async (fn: unknown, args: unknown) => {
      if (fn === signInWithEmail) {
        activeToken = "token_after_sign_in";
        return { sessionToken: activeToken, userId: "u1" };
      }
      if (fn === validateSession) {
        const token = (args as { token: string }).token;
        return token === activeToken ? { userId: "u1", sessionId: "s1" } : null;
      }
      if (fn === invalidateSession) {
        activeToken = null;
        return null;
      }
      return { ok: true };
    });

    const client = createExpoAuthClient({
      convexUrl: "https://example.convex.cloud",
      convexFunctions: {
        signInWithEmail,
        validateSession,
        invalidateSession,
      },
    });
    const convexClient = {
      setAuth: vi.fn(),
      clearAuth: vi.fn(),
    };

    const disconnect = client.connectConvexAuth(convexClient);
    const initialTokenFetcher = convexClient.setAuth.mock.calls[0]?.[0];
    expect(typeof initialTokenFetcher).toBe("function");
    await expect(initialTokenFetcher?.()).resolves.toBeNull();

    await client.signIn.email({
      email: "hello@example.com",
      password: "password123",
    });
    const afterSignInTokenFetcher = convexClient.setAuth.mock.calls[1]?.[0];
    expect(typeof afterSignInTokenFetcher).toBe("function");
    await expect(afterSignInTokenFetcher?.()).resolves.toBe("token_after_sign_in");

    await client.signOut();
    const afterSignOutTokenFetcher = convexClient.setAuth.mock.calls[2]?.[0];
    expect(typeof afterSignOutTokenFetcher).toBe("function");
    await expect(afterSignOutTokenFetcher?.()).resolves.toBeNull();

    disconnect();
    expect(convexClient.setAuth).toHaveBeenCalledTimes(3);
    expect(convexClient.clearAuth).toHaveBeenCalledTimes(3);
  });

  it("rejects invalid session tokens passed to establishSession", async () => {
    resetHandlers();

    const validateSession = mutationRef("auth.core.validateSession");
    mutationHandler.mockImplementation(async (fn: unknown, args: unknown) => {
      if (fn === validateSession) {
        expect(args).toEqual({ token: "bad_token" });
        return null;
      }
      return null;
    });

    const client = createExpoAuthClient({
      convexUrl: "https://example.convex.cloud",
      convexFunctions: {
        signInWithEmail: mutationRef("auth.core.signInWithEmail"),
        validateSession,
        invalidateSession: mutationRef("auth.core.invalidateSession"),
      },
    });

    await expect(client.establishSession("bad_token")).rejects.toThrow(
      "Could not validate session token"
    );
  });

  it("clears invalid persisted tokens when getSession cannot validate them", async () => {
    resetHandlers();

    const signInWithEmail = mutationRef("auth.core.signInWithEmail");
    const validateSession = mutationRef("auth.core.validateSession");
    const invalidateSession = mutationRef("auth.core.invalidateSession");
    const backingStore = new Map<string, string>();
    const storage = createKeyValueStorageAuthStorage({
      getItem: async (key) => backingStore.get(key) ?? null,
      setItem: async (key, value) => {
        backingStore.set(key, value);
      },
      removeItem: async (key) => {
        backingStore.delete(key);
      },
    });

    await storage.set({ token: "stale_token" });

    mutationHandler.mockImplementation(async (fn: unknown, args: unknown) => {
      if (fn === validateSession) {
        expect(args).toEqual({ token: "stale_token" });
        return null;
      }
      if (fn === signInWithEmail || fn === invalidateSession) {
        return null;
      }
      return { ok: true };
    });

    const client = createExpoAuthClient({
      convexUrl: "https://example.convex.cloud",
      convexFunctions: {
        signInWithEmail,
        validateSession,
        invalidateSession,
      },
      runtime: {
        storage,
      },
    });

    await expect(client.getSession()).resolves.toBeNull();
    await expect(client.getToken()).resolves.toBeNull();
    expect(backingStore.has("convex-zen.auth.token")).toBe(false);
  });

  it("starts and completes OAuth using Convex function refs", async () => {
    resetHandlers();

    const signInWithEmail = mutationRef("auth.core.signInWithEmail");
    const validateSession = mutationRef("auth.core.validateSession");
    const invalidateSession = mutationRef("auth.core.invalidateSession");
    const getOAuthUrl = mutationRef("auth.core.getOAuthUrl");
    const handleOAuthCallback = actionRef("auth.core.handleOAuthCallback");

    mutationHandler.mockImplementation(async (fn: unknown, args: unknown) => {
      if (fn === getOAuthUrl) {
        expect(args).toEqual({
          providerId: "google",
          callbackUrl: "myapp://auth",
          redirectTo: "/dashboard",
          errorRedirectTo: "/signin",
        });
        return {
          authorizationUrl:
            "https://accounts.example.test/o/oauth2/v2/auth?state=state_1",
        };
      }
      if (fn === validateSession) {
        expect(args).toEqual({ token: "oauth_token_1" });
        return { userId: "u1", sessionId: "s1" };
      }
      if (fn === invalidateSession || fn === signInWithEmail) {
        return null;
      }
      return { ok: true };
    });

    actionHandler.mockImplementation(async (fn: unknown, args: unknown) => {
      if (fn === handleOAuthCallback) {
        expect(args).toEqual({
          providerId: "google",
          code: "code_1",
          state: "state_1",
          callbackUrl: "myapp://auth",
          redirectTo: "/dashboard",
          errorRedirectTo: "/signin",
          ipAddress: "127.0.0.1",
          userAgent: "expo-test",
        });
        return {
          sessionToken: "oauth_token_1",
          userId: "u1",
          redirectTo: "/dashboard",
        };
      }
      return { ok: true };
    });

    const client = createExpoAuthClient({
      convexUrl: "https://example.convex.cloud",
      convexFunctions: {
        signInWithEmail,
        validateSession,
        invalidateSession,
        getOAuthUrl,
        handleOAuthCallback,
      },
    });

    await expect(
      client.signIn.oauth("google", {
        callbackUrl: "myapp://auth",
        redirectTo: "/dashboard",
        errorRedirectTo: "/signin",
      })
    ).resolves.toEqual({
      authorizationUrl:
        "https://accounts.example.test/o/oauth2/v2/auth?state=state_1",
    });

    await expect(
      client.completeOAuth({
        providerId: "google",
        code: "code_1",
        state: "state_1",
        callbackUrl: "myapp://auth",
        redirectTo: "/dashboard",
        errorRedirectTo: "/signin",
        ipAddress: "127.0.0.1",
        userAgent: "expo-test",
      })
    ).resolves.toEqual({
      session: {
        userId: "u1",
        sessionId: "s1",
      },
      redirectTo: "/dashboard",
    });

    await expect(client.getToken()).resolves.toBe("oauth_token_1");
  });

  it("generates core methods, plugin methods, and root aliases from metadata", async () => {
    resetHandlers();

    const signInWithEmail = mutationRef("auth.core.signInWithEmail");
    const validateSession = mutationRef("auth.core.validateSession");
    const invalidateSession = mutationRef("auth.core.invalidateSession");
    const currentUser = queryRef("auth.core.currentUser");
    const listUsers = queryRef("auth.plugin.admin.listUsers");
    const coreMeta = {
      currentUser: "query",
    } as const satisfies ExpoAuthCoreMeta;
    const pluginMeta = {
      admin: {
        listUsers: "query",
      },
    } as const satisfies ExpoAuthPluginMeta;

    mutationHandler.mockImplementation(async (fn: unknown, args: unknown) => {
      if (fn === signInWithEmail) {
        return { sessionToken: "token_1", userId: "u1" };
      }
      if (fn === validateSession) {
        const token = (args as { token: string }).token;
        return token === "token_1" ? { userId: "u1", sessionId: "s1" } : null;
      }
      if (fn === invalidateSession) {
        return null;
      }
      return { ok: true };
    });

    queryHandler.mockImplementation(async (fn: unknown, args: unknown) => {
      if (fn === currentUser) {
        expect(args).toEqual({});
        return { _id: "u1", email: "hello@example.com" };
      }
      if (fn === listUsers) {
        expect(args).toEqual({ limit: 10 });
        return { page: [{ _id: "u1", email: "hello@example.com" }], isDone: true };
      }
      return { ok: true };
    });

    const client = createExpoAuthClient({
      convexUrl: "https://example.convex.cloud",
      convexFunctions: {
        core: {
          signInWithEmail,
          validateSession,
          invalidateSession,
          currentUser,
        },
        plugin: {
          admin: {
            listUsers,
          },
        },
      },
      coreMeta,
      pluginMeta,
    });

    await client.signIn.email({
      email: "hello@example.com",
      password: "password123",
    });

    await expect(client.core.currentUser({})).resolves.toEqual({
      _id: "u1",
      email: "hello@example.com",
    });
    await expect(client.currentUser({})).resolves.toEqual({
      _id: "u1",
      email: "hello@example.com",
    });
    await expect(client.plugin.admin.listUsers({ limit: 10 })).resolves.toEqual({
      page: [{ _id: "u1", email: "hello@example.com" }],
      isDone: true,
    });

    const currentUserClient = convexClientInstances.at(-2);
    const listUsersClient = convexClientInstances.at(-1);
    expect(currentUserClient?.setAuth).toHaveBeenCalledWith("token_1");
    expect(listUsersClient?.setAuth).toHaveBeenCalledWith("token_1");
  });

  it("supports flat convexFunctions inputs for generated core methods", async () => {
    resetHandlers();

    const signInWithEmail = mutationRef("auth.core.signInWithEmail");
    const validateSession = mutationRef("auth.core.validateSession");
    const invalidateSession = mutationRef("auth.core.invalidateSession");
    const currentUser = queryRef("auth.core.currentUser");

    mutationHandler.mockImplementation(async (fn: unknown) => {
      if (fn === signInWithEmail) {
        return { sessionToken: "token_1", userId: "u1" };
      }
      if (fn === validateSession) {
        return { userId: "u1", sessionId: "s1" };
      }
      return null;
    });
    queryHandler.mockResolvedValue({ _id: "u1" });

    const client = createExpoAuthClient({
      convexUrl: "https://example.convex.cloud",
      convexFunctions: {
        signInWithEmail,
        validateSession,
        invalidateSession,
        currentUser,
      },
      coreMeta: {
        currentUser: "query",
      },
    });

    await expect(client.currentUser({})).resolves.toEqual({ _id: "u1" });
  });

  it("throws when plugin refs are provided without plugin metadata", () => {
    resetHandlers();

    expect(() =>
      createExpoAuthClient({
        convexUrl: "https://example.convex.cloud",
        convexFunctions: {
          signInWithEmail: mutationRef("auth.core.signInWithEmail"),
          validateSession: mutationRef("auth.core.validateSession"),
          invalidateSession: mutationRef("auth.core.invalidateSession"),
          plugin: {
            admin: {
              listUsers: queryRef("auth.plugin.admin.listUsers"),
            },
          },
        },
      })
    ).toThrow(
      'createExpoAuthClient requires "pluginMeta" when convexFunctions.plugin is provided.'
    );
  });

  it("throws when core metadata references missing function refs", () => {
    resetHandlers();

    expect(() =>
      createExpoAuthClient({
        convexUrl: "https://example.convex.cloud",
        convexFunctions: {
          signInWithEmail: mutationRef("auth.core.signInWithEmail"),
          validateSession: mutationRef("auth.core.validateSession"),
          invalidateSession: mutationRef("auth.core.invalidateSession"),
        },
        coreMeta: {
          currentUser: "query",
        },
      })
    ).toThrow('createExpoAuthClient could not resolve "currentUser" in convexFunctions.');
  });

  it("throws when a core root alias would shadow a reserved auth client key", () => {
    resetHandlers();

    expect(() =>
      createExpoAuthClient({
        convexUrl: "https://example.convex.cloud",
        convexFunctions: {
          signInWithEmail: mutationRef("auth.core.signInWithEmail"),
          validateSession: mutationRef("auth.core.validateSession"),
          invalidateSession: mutationRef("auth.core.invalidateSession"),
          getSession: queryRef("auth.core.getSession"),
        },
        coreMeta: {
          getSession: "query",
        },
      })
    ).toThrow(
      'createExpoAuthClient could not alias "core.getSession" at authClient root'
    );
  });
});
