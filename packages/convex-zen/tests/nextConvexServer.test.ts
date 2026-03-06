import { describe, expect, it, vi } from "vitest";
import type { FunctionReference } from "convex/server";
import type { SessionTokenCodec } from "../src/client/tanstack-start-identity-jwt";
import {
  createNextAuthServer,
  createNextConvexFetchers,
} from "../src/client/next";

const { nextHeaders } = vi.hoisted(() => {
  return {
    nextHeaders: vi.fn<() => Headers | Promise<Headers>>(),
  };
});

vi.mock("next/headers", () => ({
  headers: nextHeaders,
}));

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

const passthroughCodec: SessionTokenCodec = {
  encode: async (value) => value.sessionToken,
  decode: async (token) => ({ userId: "u1", sessionToken: token }),
};

describe("createNextConvexFetchers", () => {
  it("uses request-bound session token for authenticated fetchers", async () => {
    convexClientInstances.length = 0;
    queryHandler.mockReset();
    mutationHandler.mockReset();
    actionHandler.mockReset();

    const request = new Request("http://localhost/dashboard");
    const requireSession = vi.fn(async () => ({
      token: "token_123",
      session: { userId: "u1", sessionId: "s1" },
    }));
    const fetchers = createNextConvexFetchers({
      nextAuth: { requireSession },
      convexUrl: "https://example.convex.cloud",
    });

    const currentUser = queryRef("auth.core.currentUser");
    await fetchers.fetchAuthQuery(request, currentUser, {});

    expect(requireSession).toHaveBeenCalledTimes(1);
    expect(requireSession).toHaveBeenCalledWith(request);
    expect(convexClientInstances).toHaveLength(2);
    expect(convexClientInstances[1]?.setAuth).toHaveBeenCalledWith("token_123");
    expect(convexClientInstances[1]?.query).toHaveBeenCalledWith(currentUser, {});
  });
});

describe("createNextAuthServer", () => {
  it("supports getToken() without passing a Request", async () => {
    convexClientInstances.length = 0;
    mutationHandler.mockReset();
    nextHeaders.mockReset();

    const signInWithEmail = mutationRef("auth.core.signInWithEmail");
    const validateSession = mutationRef("auth.core.validateSession");
    const invalidateSession = mutationRef("auth.core.invalidateSession");

    mutationHandler.mockImplementation(async (fn: unknown) => {
      if (fn === validateSession) {
        return { userId: "u1", sessionId: "s1" };
      }
      if (fn === signInWithEmail) {
        return { sessionToken: "token_1", userId: "u1" };
      }
      if (fn === invalidateSession) {
        return null;
      }
      return { ok: true };
    });

    nextHeaders.mockResolvedValue(
      new Headers({
        host: "localhost:3000",
        cookie: "cz_session=token_1",
      })
    );

    const authServer = createNextAuthServer({
      convexUrl: "https://example.convex.cloud",
      convexFunctions: {
        signInWithEmail,
        validateSession,
        invalidateSession,
      },
      sessionTokenCodec: passthroughCodec,
    });

    await expect(authServer.getSession()).resolves.toEqual({
      userId: "u1",
      sessionId: "s1",
    });
    await expect(authServer.getToken()).resolves.toBe("token_1");
    await expect(
      authServer.getSession(
        new Request("http://localhost/dashboard", {
          headers: {
            cookie: "cz_session=token_1",
          },
        })
      )
    ).resolves.toEqual({
      userId: "u1",
      sessionId: "s1",
    });
    await expect(
      authServer.getToken(
        new Request("http://localhost/dashboard", {
          headers: {
            cookie: "cz_session=token_1",
          },
        })
      )
    ).resolves.toBe("token_1");
  });

  it("supports fetchAuthQuery() without passing a Request", async () => {
    convexClientInstances.length = 0;
    queryHandler.mockReset();
    mutationHandler.mockReset();
    nextHeaders.mockReset();

    const signInWithEmail = mutationRef("auth.core.signInWithEmail");
    const validateSession = mutationRef("auth.core.validateSession");
    const invalidateSession = mutationRef("auth.core.invalidateSession");
    const currentUser = queryRef("auth.core.currentUser");

    mutationHandler.mockImplementation(async (fn: unknown) => {
      if (fn === validateSession) {
        return { userId: "u1", sessionId: "s1" };
      }
      if (fn === signInWithEmail) {
        return { sessionToken: "token_1", userId: "u1" };
      }
      if (fn === invalidateSession) {
        return null;
      }
      return { ok: true };
    });

    queryHandler.mockImplementation(async (fn: unknown, args: unknown) => {
      if (fn === currentUser) {
        expect(args).toEqual({});
        return { _id: "u1", email: "demo@example.com" };
      }
      return { ok: true };
    });

    nextHeaders.mockResolvedValue(
      new Headers({
        host: "localhost:3000",
        cookie: "cz_session=token_1",
      })
    );

    const authServer = createNextAuthServer({
      convexUrl: "https://example.convex.cloud",
      convexFunctions: {
        signInWithEmail,
        validateSession,
        invalidateSession,
      },
      sessionTokenCodec: passthroughCodec,
    });

    await expect(authServer.fetchAuthQuery(currentUser, {})).resolves.toEqual({
      _id: "u1",
      email: "demo@example.com",
    });
    expect(nextHeaders).toHaveBeenCalledTimes(1);
  });

  it("supports authenticated core/plugin api routes and fetchers", async () => {
    convexClientInstances.length = 0;
    queryHandler.mockReset();
    mutationHandler.mockReset();
    actionHandler.mockReset();

    const signInWithEmail = mutationRef("auth.core.signInWithEmail");
    const validateSession = mutationRef("auth.core.validateSession");
    const invalidateSession = mutationRef("auth.core.invalidateSession");
    const currentUser = queryRef("auth.core.currentUser");
    const listUsers = queryRef("auth.plugin.admin.listUsers");

    mutationHandler.mockImplementation(async (fn: unknown, args: unknown) => {
      if (fn === validateSession) {
        expect(args).toEqual({ token: "token_1" });
        return { userId: "u1", sessionId: "s1" };
      }
      if (fn === signInWithEmail) {
        return { sessionToken: "token_1", userId: "u1" };
      }
      if (fn === invalidateSession) {
        return null;
      }
      return { ok: true };
    });

    queryHandler.mockImplementation(async (fn: unknown, args: unknown) => {
      if (fn === currentUser) {
        expect(args).toEqual({});
        return { _id: "u1", email: "demo@example.com" };
      }
      if (fn === listUsers) {
        expect(args).toEqual({ limit: 5 });
        return { users: [], cursor: null, isDone: true };
      }
      return { ok: true };
    });

    const authServer = createNextAuthServer({
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
      } as unknown as {
        core: {
          signInWithEmail: FunctionReference<"mutation", "public">;
          validateSession: FunctionReference<"mutation", "public">;
          invalidateSession: FunctionReference<"mutation", "public">;
          currentUser: FunctionReference<"query", "public">;
        };
        plugin: {
          admin: {
            listUsers: FunctionReference<"query", "public">;
          };
        };
      },
      meta: {
        core: {
          currentUser: "query",
        },
        plugin: {
          admin: {
            listUsers: "query",
          },
        },
      },
      sessionTokenCodec: passthroughCodec,
    });

    const coreResponse = await authServer.handler(
      new Request("http://localhost/api/auth/core/current-user", {
        method: "POST",
        headers: {
          cookie: "cz_session=token_1",
          "content-type": "application/json",
        },
        body: "{}",
      })
    );
    expect(coreResponse.status).toBe(200);
    await expect(coreResponse.json()).resolves.toEqual({
      _id: "u1",
      email: "demo@example.com",
    });

    const pluginResponse = await authServer.handler(
      new Request("http://localhost/api/auth/plugin/admin/list-users", {
        method: "POST",
        headers: {
          cookie: "cz_session=token_1",
          "content-type": "application/json",
        },
        body: JSON.stringify({ limit: 5 }),
      })
    );
    expect(pluginResponse.status).toBe(200);
    await expect(pluginResponse.json()).resolves.toEqual({
      users: [],
      cursor: null,
      isDone: true,
    });

    await expect(
      authServer.fetchAuthQuery(
        new Request("http://localhost/dashboard", {
          headers: {
            cookie: "cz_session=token_1",
          },
        }),
        currentUser,
        {}
      )
    ).resolves.toEqual({
      _id: "u1",
      email: "demo@example.com",
    });
  });

  it('supports disabling auto api plugins with plugins: []', async () => {
    convexClientInstances.length = 0;
    queryHandler.mockReset();
    mutationHandler.mockReset();

    const signInWithEmail = mutationRef("auth.core.signInWithEmail");
    const validateSession = mutationRef("auth.core.validateSession");
    const invalidateSession = mutationRef("auth.core.invalidateSession");
    const currentUser = queryRef("auth.core.currentUser");

    mutationHandler.mockImplementation(async (fn: unknown) => {
      if (fn === validateSession) {
        return { userId: "u1", sessionId: "s1" };
      }
      if (fn === signInWithEmail) {
        return { sessionToken: "token_1", userId: "u1" };
      }
      if (fn === invalidateSession) {
        return null;
      }
      return { ok: true };
    });

    queryHandler.mockImplementation(async (fn: unknown) => {
      if (fn === currentUser) {
        return { _id: "u1", email: "demo@example.com" };
      }
      return { ok: true };
    });

    const authServer = createNextAuthServer({
      convexUrl: "https://example.convex.cloud",
      convexFunctions: {
        core: {
          signInWithEmail,
          validateSession,
          invalidateSession,
          currentUser,
        },
      } as unknown as {
        core: {
          signInWithEmail: FunctionReference<"mutation", "public">;
          validateSession: FunctionReference<"mutation", "public">;
          invalidateSession: FunctionReference<"mutation", "public">;
          currentUser: FunctionReference<"query", "public">;
        };
      },
      meta: {
        core: {
          currentUser: "query",
        },
        plugin: {},
      },
      plugins: [],
      sessionTokenCodec: passthroughCodec,
    });

    const coreResponse = await authServer.handler(
      new Request("http://localhost/api/auth/core/current-user", {
        method: "POST",
        headers: {
          cookie: "cz_session=token_1",
          "content-type": "application/json",
        },
        body: "{}",
      })
    );

    expect(coreResponse.status).toBe(404);
  });

  it("supports custom Next auth api plugin factories", async () => {
    convexClientInstances.length = 0;
    mutationHandler.mockReset();

    const signInWithEmail = mutationRef("auth.core.signInWithEmail");
    const validateSession = mutationRef("auth.core.validateSession");
    const invalidateSession = mutationRef("auth.core.invalidateSession");

    mutationHandler.mockImplementation(async (fn: unknown) => {
      if (fn === validateSession) {
        return { userId: "u1", sessionId: "s1" };
      }
      if (fn === signInWithEmail) {
        return { sessionToken: "token_1", userId: "u1" };
      }
      if (fn === invalidateSession) {
        return null;
      }
      return { ok: true };
    });

    const authServer = createNextAuthServer({
      convexUrl: "https://example.convex.cloud",
      convexFunctions: {
        signInWithEmail,
        validateSession,
        invalidateSession,
      },
      plugins: [
        {
          create: () => ({
            id: "custom",
            handle: async (context) => {
              if (context.method !== "POST" || context.action !== "custom/ping") {
                return null;
              }
              return context.json({ ok: true });
            },
          }),
        },
      ],
      sessionTokenCodec: passthroughCodec,
    });

    const customResponse = await authServer.handler(
      new Request("http://localhost/api/auth/custom/ping", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: "{}",
      })
    );

    expect(customResponse.status).toBe(200);
    await expect(customResponse.json()).resolves.toEqual({ ok: true });
  });
});
