import { describe, expect, it, vi } from "vitest";
import type { FunctionReference } from "convex/server";
import {
  connectConvexZen,
  createTanStackAuthClient,
} from "../src/client/tanstack-start-client";

const adminPluginMeta = {
  admin: {
    listUsers: "query",
    banUser: "mutation",
    setRole: "mutation",
    unbanUser: "mutation",
    deleteUser: "mutation",
  },
} as const;

const authMeta = {
  core: {},
  plugin: adminPluginMeta,
} as const;

function createNonEnumerableCoreFunctionsProxy() {
  const coreRefs = {
    signUp: mutationRef("signUp"),
    currentUser: queryRef("currentUser"),
  };
  const core = new Proxy(
    {},
    {
      get: (_target, prop) =>
        typeof prop === "string"
          ? (coreRefs as Record<string, unknown>)[prop]
          : undefined,
      ownKeys: () => [],
      getOwnPropertyDescriptor: () => undefined,
    }
  );
  return new Proxy(
    {},
    {
      get: (_target, prop) => (prop === "core" ? core : undefined),
      ownKeys: () => [],
      getOwnPropertyDescriptor: () => undefined,
    }
  );
}

function mutationRef(name: string): FunctionReference<"mutation", "public"> {
  return { name } as unknown as FunctionReference<"mutation", "public">;
}

function queryRef(name: string): FunctionReference<"query", "public"> {
  return { name } as unknown as FunctionReference<"query", "public">;
}

class MockBroadcastChannel {
  static channels = new Map<string, Set<MockBroadcastChannel>>();

  readonly name: string;
  private listeners = new Set<(event: MessageEvent<unknown>) => void>();

  constructor(name: string) {
    this.name = name;
    const peers = MockBroadcastChannel.channels.get(name) ?? new Set();
    peers.add(this);
    MockBroadcastChannel.channels.set(name, peers);
  }

  postMessage(data: unknown): void {
    const peers = MockBroadcastChannel.channels.get(this.name);
    if (!peers) {
      return;
    }
    for (const peer of peers) {
      if (peer === this) {
        continue;
      }
      for (const listener of peer.listeners) {
        listener({ data } as MessageEvent<unknown>);
      }
    }
  }

  addEventListener(
    type: string,
    listener: (event: MessageEvent<unknown>) => void
  ): void {
    if (type === "message") {
      this.listeners.add(listener);
    }
  }

  removeEventListener(
    type: string,
    listener: (event: MessageEvent<unknown>) => void
  ): void {
    if (type === "message") {
      this.listeners.delete(listener);
    }
  }

  close(): void {
    const peers = MockBroadcastChannel.channels.get(this.name);
    if (!peers) {
      return;
    }
    peers.delete(this);
    if (peers.size === 0) {
      MockBroadcastChannel.channels.delete(this.name);
    }
  }
}

describe("createTanStackAuthClient auto plugins", () => {
  it("loads auth token from route and caches until forceRefresh", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/auth/token")) {
        return new Response(JSON.stringify({ token: "token_123" }), {
          status: 200,
          headers: { "content-type": "application/json; charset=utf-8" },
        });
      }
      return new Response("{}");
    });

    const authClient = createTanStackAuthClient({ fetch: fetchImpl });

    await expect(authClient.getToken()).resolves.toBe("token_123");
    await expect(authClient.getToken()).resolves.toBe("token_123");
    await expect(authClient.getToken({ forceRefresh: true })).resolves.toBe(
      "token_123"
    );

    expect(
      fetchImpl.mock.calls.filter(([input]) =>
        String(input).includes("/api/auth/token")
      )
    ).toHaveLength(2);
  });

  it("supports connectConvexAuth and refreshes token bridge after auth changes", async () => {
    let tokenValue: string | null = null;
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/auth/token")) {
        return new Response(JSON.stringify({ token: tokenValue }), {
          status: 200,
          headers: { "content-type": "application/json; charset=utf-8" },
        });
      }
      if (url.includes("/api/auth/sign-in-with-email")) {
        tokenValue = "token_after_sign_in";
        return new Response(JSON.stringify({ session: { userId: "u1" } }), {
          status: 200,
          headers: { "content-type": "application/json; charset=utf-8" },
        });
      }
      if (url.includes("/api/auth/sign-out")) {
        tokenValue = null;
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "content-type": "application/json; charset=utf-8" },
        });
      }
      return new Response("{}");
    });
    const authClient = createTanStackAuthClient({ fetch: fetchImpl });
    const convexClient = {
      setAuth: vi.fn(),
      clearAuth: vi.fn(),
    };

    const disconnect = authClient.connectConvexAuth(convexClient);
    const initialTokenFetcher = convexClient.setAuth.mock.calls[0]?.[0];
    expect(typeof initialTokenFetcher).toBe("function");
    await expect(initialTokenFetcher?.()).resolves.toBeNull();

    await authClient.signIn.email({
      email: "hello@example.com",
      password: "password123",
    });
    const afterSignInTokenFetcher = convexClient.setAuth.mock.calls[1]?.[0];
    expect(typeof afterSignInTokenFetcher).toBe("function");
    await expect(afterSignInTokenFetcher?.()).resolves.toBe("token_after_sign_in");

    await authClient.signOut();
    const afterSignOutTokenFetcher = convexClient.setAuth.mock.calls[2]?.[0];
    expect(typeof afterSignOutTokenFetcher).toBe("function");
    await expect(afterSignOutTokenFetcher?.()).resolves.toBeNull();

    disconnect();
    expect(convexClient.setAuth).toHaveBeenCalledTimes(3);
    expect(convexClient.clearAuth).toHaveBeenCalledTimes(3);
  });

  it("reconnects convex auth bridge when clearToken is called", async () => {
    const authClient = createTanStackAuthClient({
      fetch: vi.fn(async () => new Response("{}")),
    });
    const convexClient = {
      setAuth: vi.fn(),
      clearAuth: vi.fn(),
    };
    const disconnect = authClient.connectConvexAuth(convexClient);

    authClient.clearToken();
    expect(convexClient.setAuth).toHaveBeenCalledTimes(2);
    expect(convexClient.clearAuth).toHaveBeenCalledTimes(1);

    disconnect();
  });

  it("connectConvexZen deduplicates bridge setup per client pair", () => {
    const authClient = createTanStackAuthClient({
      fetch: vi.fn(async () => new Response("{}")),
    });
    const convexClient = {
      setAuth: vi.fn(),
      clearAuth: vi.fn(),
    };

    const disconnectA = connectConvexZen(authClient, convexClient, {
      browserOnly: false,
    });
    const disconnectB = connectConvexZen(authClient, convexClient, {
      browserOnly: false,
    });

    expect(convexClient.setAuth).toHaveBeenCalledTimes(1);

    disconnectB();
    expect(convexClient.clearAuth).toHaveBeenCalledTimes(0);

    disconnectA();
    expect(convexClient.clearAuth).toHaveBeenCalledTimes(1);

    disconnectA();
    disconnectB();
    expect(convexClient.clearAuth).toHaveBeenCalledTimes(1);

    connectConvexZen(authClient, convexClient, { browserOnly: false });
    expect(convexClient.setAuth).toHaveBeenCalledTimes(2);
  });

  it("invalidates cached token when convex auth onChange reports unauthenticated", async () => {
    let tokenCallCount = 0;
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes("/api/auth/token")) {
        tokenCallCount += 1;
        return new Response(JSON.stringify({ token: `token_${tokenCallCount}` }), {
          status: 200,
          headers: { "content-type": "application/json; charset=utf-8" },
        });
      }
      return new Response("{}");
    });
    const authClient = createTanStackAuthClient({ fetch: fetchImpl });
    const convexClient = {
      setAuth: vi.fn(),
      clearAuth: vi.fn(),
    };

    const disconnect = authClient.connectConvexAuth(convexClient);
    const onChange = convexClient.setAuth.mock.calls[0]?.[1] as
      | ((isAuthenticated: boolean) => void)
      | undefined;
    await expect(authClient.getToken()).resolves.toBe("token_1");
    onChange?.(false);
    await expect(authClient.getToken()).resolves.toBe("token_2");
    expect(tokenCallCount).toBe(2);

    disconnect();
  });

  it("forces one token refresh after auth failure, then returns null after a second failure", async () => {
    let tokenCallCount = 0;
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes("/api/auth/token")) {
        tokenCallCount += 1;
        return new Response(JSON.stringify({ token: `token_${tokenCallCount}` }), {
          status: 200,
          headers: { "content-type": "application/json; charset=utf-8" },
        });
      }
      if (String(input).includes("/api/auth/sign-in-with-email")) {
        return new Response(JSON.stringify({ session: { userId: "u1" } }), {
          status: 200,
          headers: { "content-type": "application/json; charset=utf-8" },
        });
      }
      return new Response("{}");
    });
    const authClient = createTanStackAuthClient({ fetch: fetchImpl });
    const convexClient = {
      setAuth: vi.fn(),
      clearAuth: vi.fn(),
    };

    const disconnect = authClient.connectConvexAuth(convexClient);
    const initialFetchToken = convexClient.setAuth.mock.calls[0]?.[0] as
      | (() => Promise<string | null>)
      | undefined;
    const onChange = convexClient.setAuth.mock.calls[0]?.[1] as
      | ((isAuthenticated: boolean) => void)
      | undefined;
    await expect(initialFetchToken?.()).resolves.toBe("token_1");

    onChange?.(false);
    await expect(initialFetchToken?.()).resolves.toBe("token_2");

    onChange?.(false);
    await expect(initialFetchToken?.()).resolves.toBeNull();

    await authClient.signIn.email({
      email: "hello@example.com",
      password: "password123",
    });
    const postSignInFetchToken = convexClient.setAuth.mock.calls[1]?.[0] as
      | (() => Promise<string | null>)
      | undefined;
    await expect(postSignInFetchToken?.()).resolves.toBe("token_3");
    expect(tokenCallCount).toBe(3);

    disconnect();
  });

  it("supports direct-query auth lifecycle for currentUser and admin listUsers", async () => {
    let currentToken: string | null = null;
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/auth/token")) {
        return new Response(JSON.stringify({ token: currentToken }), {
          status: 200,
          headers: { "content-type": "application/json; charset=utf-8" },
        });
      }
      if (url.includes("/api/auth/sign-in-with-email")) {
        currentToken = "admin_token";
        return new Response(JSON.stringify({ session: { userId: "admin_1" } }), {
          status: 200,
          headers: { "content-type": "application/json; charset=utf-8" },
        });
      }
      if (url.includes("/api/auth/sign-out")) {
        currentToken = null;
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "content-type": "application/json; charset=utf-8" },
        });
      }
      return new Response("{}");
    });
    const authClient = createTanStackAuthClient({ fetch: fetchImpl });
    const convexClient = {
      setAuth: vi.fn(),
      clearAuth: vi.fn(),
    };
    const disconnect = authClient.connectConvexAuth(convexClient);

    const latestTokenFetcher = () =>
      convexClient.setAuth.mock.calls.at(-1)?.[0] as
        | (() => Promise<string | null>)
        | undefined;

    const directCurrentUser = async () => {
      const token = await latestTokenFetcher()?.();
      if (!token) {
        return null;
      }
      return { _id: "admin_1", email: "admin@example.com" };
    };
    const directAdminListUsers = async () => {
      const token = await latestTokenFetcher()?.();
      if (token !== "admin_token") {
        return [];
      }
      return [{ _id: "admin_1", email: "admin@example.com" }];
    };

    await expect(directCurrentUser()).resolves.toBeNull();
    await expect(directAdminListUsers()).resolves.toEqual([]);

    await authClient.signIn.email({
      email: "admin@example.com",
      password: "password123",
    });
    await expect(directCurrentUser()).resolves.toEqual({
      _id: "admin_1",
      email: "admin@example.com",
    });
    await expect(directAdminListUsers()).resolves.toEqual([
      { _id: "admin_1", email: "admin@example.com" },
    ]);

    await authClient.signOut();
    await expect(directCurrentUser()).resolves.toBeNull();
    await expect(directAdminListUsers()).resolves.toEqual([]);

    disconnect();
  });

  it("propagates token clear events across tabs when tokenSync is enabled", async () => {
    MockBroadcastChannel.channels.clear();
    vi.stubGlobal("window", {} as Window & typeof globalThis);
    vi.stubGlobal(
      "BroadcastChannel",
      MockBroadcastChannel as unknown as typeof BroadcastChannel
    );
    try {
      const sharedFetch = vi.fn(async (input: RequestInfo | URL) => {
        if (String(input).includes("/api/auth/token")) {
          return new Response(JSON.stringify({ token: "token_1" }), {
            status: 200,
            headers: { "content-type": "application/json; charset=utf-8" },
          });
        }
        return new Response("{}");
      });

      const authClientA = createTanStackAuthClient({
        fetch: sharedFetch,
        tokenSync: true,
      });
      const authClientB = createTanStackAuthClient({
        fetch: sharedFetch,
        tokenSync: true,
      });

      const convexClientA = { setAuth: vi.fn(), clearAuth: vi.fn() };
      const convexClientB = { setAuth: vi.fn(), clearAuth: vi.fn() };
      const disconnectA = authClientA.connectConvexAuth(convexClientA);
      const disconnectB = authClientB.connectConvexAuth(convexClientB);

      authClientA.clearToken();

      expect(convexClientA.setAuth).toHaveBeenCalledTimes(2);
      expect(convexClientA.clearAuth).toHaveBeenCalledTimes(1);
      expect(convexClientB.setAuth).toHaveBeenCalledTimes(2);
      expect(convexClientB.clearAuth).toHaveBeenCalledTimes(1);

      disconnectA();
      disconnectB();
    } finally {
      MockBroadcastChannel.channels.clear();
      vi.unstubAllGlobals();
    }
  });

  it('infers plugin methods by default ("auto") from convexFunctions + pluginMeta', () => {
    const authClient = createTanStackAuthClient({
      fetch: vi.fn(async () => new Response("{}")),
      convexFunctions: {
        plugin: {
          admin: {
            listUsers: queryRef("listUsers"),
            banUser: mutationRef("banUser"),
            setRole: mutationRef("setRole"),
            unbanUser: mutationRef("unbanUser"),
            deleteUser: mutationRef("deleteUser"),
          },
        },
      },
      pluginMeta: adminPluginMeta,
    });

    expect(typeof authClient.plugin.admin.listUsers).toBe("function");
    expect(typeof authClient.plugin.admin.banUser).toBe("function");
    expect(typeof authClient.plugin.admin.setRole).toBe("function");
    expect(typeof authClient.plugin.admin.unbanUser).toBe("function");
    expect(typeof authClient.plugin.admin.deleteUser).toBe("function");
  });

  it('infers plugin methods by default ("auto") from convexFunctions + meta', () => {
    const authClient = createTanStackAuthClient({
      fetch: vi.fn(async () => new Response("{}")),
      convexFunctions: {
        plugin: {
          admin: {
            listUsers: queryRef("listUsers"),
            banUser: mutationRef("banUser"),
            setRole: mutationRef("setRole"),
            unbanUser: mutationRef("unbanUser"),
            deleteUser: mutationRef("deleteUser"),
          },
        },
      },
      meta: authMeta,
    });

    expect(typeof authClient.plugin.admin.listUsers).toBe("function");
    expect(typeof authClient.plugin.admin.banUser).toBe("function");
  });

  it("calls the plugin API route when using inferred auto plugin methods", async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response(
        JSON.stringify({ users: [], cursor: null, isDone: true }),
        {
          status: 200,
          headers: { "content-type": "application/json; charset=utf-8" },
        }
      );
    });
    const authClient = createTanStackAuthClient({
      fetch: fetchImpl,
      convexFunctions: {
        plugin: {
          admin: {
            listUsers: queryRef("listUsers"),
          },
        },
      },
      pluginMeta: {
        admin: {
          listUsers: "query",
        },
      },
    });

    const result = await authClient.plugin.admin.listUsers({ limit: 5 });

    expect(result).toEqual({ users: [], cursor: null, isDone: true });
    const firstCall = fetchImpl.mock.calls[0];
    expect(firstCall).toBeDefined();
    expect(String(firstCall?.[0])).toContain("/api/auth/plugin/admin/list-users");
    expect(firstCall?.[1]?.method).toBe("POST");
  });

  it("supports disabling auto plugins with plugins: []", () => {
    const authClient = createTanStackAuthClient({
      plugins: [] as const,
      fetch: vi.fn(async () => new Response("{}")),
      convexFunctions: {
        plugin: {
          admin: {
            listUsers: queryRef("listUsers"),
          },
        },
      },
      pluginMeta: {
        admin: {
          listUsers: "query",
        },
      },
    });

    expect((authClient as { plugin?: unknown }).plugin).toBeUndefined();
  });

  it("throws when auto plugins are enabled without pluginMeta", () => {
    expect(() =>
      createTanStackAuthClient({
        fetch: vi.fn(async () => new Response("{}")),
        convexFunctions: {
          plugin: {
            admin: {
              listUsers: queryRef("listUsers"),
            },
          },
        },
      })
    ).toThrow('createTanStackAuthClient requires "pluginMeta"');
  });

  it("infers core methods from convexFunctions.core without requiring pluginMeta", async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    });
    const authClient = createTanStackAuthClient({
      fetch: fetchImpl,
      convexFunctions: {
        core: {
          signUp: mutationRef("signUp"),
          requestPasswordReset: mutationRef("requestPasswordReset"),
        },
      },
    });

    expect(typeof authClient.core.signUp).toBe("function");
    expect(typeof authClient.core.requestPasswordReset).toBe("function");

    await authClient.core.signUp({
      email: "hello@example.com",
      password: "password123",
    });

    const firstCall = fetchImpl.mock.calls[0];
    expect(firstCall).toBeDefined();
    expect(String(firstCall?.[0])).toContain("/api/auth/core/sign-up");
    expect(firstCall?.[1]?.method).toBe("POST");
  });

  it("infers core methods from meta.core for proxy-based convexFunctions", async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    });
    const authClient = createTanStackAuthClient({
      fetch: fetchImpl,
      convexFunctions:
        createNonEnumerableCoreFunctionsProxy() as unknown as {
          core: {
            signUp: FunctionReference<"mutation", "public">;
            currentUser: FunctionReference<"query", "public">;
          };
        },
      meta: {
        core: {
          signUp: "mutation",
          currentUser: "query",
        },
        plugin: {},
      },
    });

    expect(typeof authClient.core.currentUser).toBe("function");
    expect(typeof authClient.currentUser).toBe("function");
    await authClient.currentUser({});

    const firstCall = fetchImpl.mock.calls[0];
    expect(firstCall).toBeDefined();
    expect(String(firstCall?.[0])).toContain("/api/auth/core/current-user");
    expect(firstCall?.[1]?.method).toBe("POST");
  });

  it("aliases non-conflicting core methods at authClient root by default", async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    });
    const authClient = createTanStackAuthClient({
      fetch: fetchImpl,
      convexFunctions: {
        core: {
          signUp: mutationRef("signUp"),
        },
      },
    });

    expect(typeof authClient.signUp).toBe("function");
    await authClient.signUp({ email: "hello@example.com", password: "password123" });

    const firstCall = fetchImpl.mock.calls[0];
    expect(firstCall).toBeDefined();
    expect(String(firstCall?.[0])).toContain("/api/auth/core/sign-up");
    expect(firstCall?.[1]?.method).toBe("POST");
  });

  it("aliases generated core signInWithEmail while keeping nested signIn.email", () => {
    const authClient = createTanStackAuthClient({
      fetch: vi.fn(async () => new Response("{}")),
      convexFunctions: {
        core: {
          signInWithEmail: mutationRef("signInWithEmail"),
        },
      },
    });

    expect(typeof authClient.signIn.email).toBe("function");
    expect(typeof authClient.signInWithEmail).toBe("function");
    expect(typeof authClient.core.signInWithEmail).toBe("function");
  });

  it("throws on conflicting root aliases by default", () => {
    expect(() =>
      createTanStackAuthClient({
        fetch: vi.fn(async () => new Response("{}")),
        convexFunctions: {
          core: {
            signOut: mutationRef("signOut"),
          },
        },
      })
    ).toThrow('could not alias "core.signOut"');
  });

});
