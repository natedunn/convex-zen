import { describe, expect, it, vi } from "vitest";
import { createRouteAuthRuntimeAdapter } from "../src/client/framework-adapter";

describe("createRouteAuthRuntimeAdapter", () => {
  it("loads and caches auth token until forceRefresh", async () => {
    let tokenCallCount = 0;
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes("/api/auth/token")) {
        tokenCallCount += 1;
        return new Response(JSON.stringify({ token: `token_${tokenCallCount}` }), {
          status: 200,
          headers: { "content-type": "application/json; charset=utf-8" },
        });
      }
      return new Response("{}", {
        status: 200,
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    });

    const client = createRouteAuthRuntimeAdapter({ fetch: fetchImpl });

    await expect(client.getToken()).resolves.toBe("token_1");
    await expect(client.getToken()).resolves.toBe("token_1");
    await expect(client.getToken({ forceRefresh: true })).resolves.toBe("token_2");

    expect(
      fetchImpl.mock.calls.filter(([input]) =>
        String(input).includes("/api/auth/token")
      )
    ).toHaveLength(2);
  });

  it("bridges convex auth and refreshes after sign-in and sign-out", async () => {
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
        return new Response(
          JSON.stringify({ session: { userId: "u1", sessionId: "s1" } }),
          {
            status: 200,
            headers: { "content-type": "application/json; charset=utf-8" },
          }
        );
      }
      if (url.includes("/api/auth/sign-out")) {
        tokenValue = null;
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "content-type": "application/json; charset=utf-8" },
        });
      }
      return new Response("{}", {
        status: 200,
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    });

    const client = createRouteAuthRuntimeAdapter({ fetch: fetchImpl });
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

  it("supports custom route names and sign-in payload mapping", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/custom/sign-in")) {
        const body = JSON.parse(String(init?.body ?? "{}")) as {
          email?: string;
          password?: string;
          ipAddress?: string;
        };
        expect(body).toEqual({
          email: "hello@example.com",
          password: "password123",
          ipAddress: "127.0.0.1",
        });
        return new Response(
          JSON.stringify({ session: { userId: "u1", sessionId: "s1" } }),
          {
            status: 200,
            headers: { "content-type": "application/json; charset=utf-8" },
          }
        );
      }
      if (url.endsWith("/custom/session")) {
        return new Response(
          JSON.stringify({ session: { userId: "u1", sessionId: "s1" } }),
          {
            status: 200,
            headers: { "content-type": "application/json; charset=utf-8" },
          }
        );
      }
      if (url.endsWith("/custom/token")) {
        return new Response(JSON.stringify({ token: null }), {
          status: 200,
          headers: { "content-type": "application/json; charset=utf-8" },
        });
      }
      return new Response("{}", {
        status: 200,
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    });

    const client = createRouteAuthRuntimeAdapter({
      basePath: "/custom",
      fetch: fetchImpl,
      routes: {
        session: "session",
        token: "token",
        signInWithEmail: "sign-in",
      },
      toSignInBody: (input) => ({
        email: input.email,
        password: input.password,
        ipAddress: input.ipAddress,
      }),
    });

    await client.signIn.email({
      email: "hello@example.com",
      password: "password123",
      ipAddress: "127.0.0.1",
    });

    await expect(client.getSession()).resolves.toEqual({
      userId: "u1",
      sessionId: "s1",
    });
  });
});
