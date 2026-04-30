import { describe, expect, it, vi } from "vitest";
import type { FunctionReference } from "convex/server";
import { createSessionPrimitives } from "../src/client/primitives";
import {
  createNextAuthApiHandler,
  createNextServerAuthWithHandler,
  createNextServerAuth,
} from "../src/client/next";

function parseCookieValue(setCookie: string | null, cookieName: string): string | null {
  if (!setCookie) {
    return null;
  }
  const cookiePair = setCookie.split(";", 1)[0];
  if (!cookiePair) {
    return null;
  }
  const [name, ...valueParts] = cookiePair.split("=");
  if (name !== cookieName || valueParts.length === 0) {
    return null;
  }
  return decodeURIComponent(valueParts.join("="));
}

describe("next server auth helpers", () => {
  it("handles sign-in, session/token reads, and sign-out via api handler", async () => {
    const sessions = new Map<string, { userId: string; sessionId: string }>();
    const lastSignInInput = {
      value: null as null | { email: string; userAgent?: string; ipAddress?: string },
    };

    const primitives = createSessionPrimitives({
      signIn: async (input) => {
        lastSignInInput.value = {
          email: input.email,
          ...(input.userAgent !== undefined ? { userAgent: input.userAgent } : {}),
          ...(input.ipAddress !== undefined ? { ipAddress: input.ipAddress } : {}),
        };

        if (input.email !== "demo@example.com" || input.password !== "password123") {
          throw new Error("Invalid email or password");
        }

        const sessionToken = `token_${sessions.size + 1}`;
        sessions.set(sessionToken, {
          userId: "u_demo",
          sessionId: `s_${sessions.size + 1}`,
        });

        return {
          sessionToken,
          userId: "u_demo",
        };
      },
      validateSession: async (token) => {
        return sessions.get(token) ?? null;
      },
      signOut: async (token) => {
        sessions.delete(token);
      },
    });

    const nextAuth = createNextServerAuth({ primitives });
    const handler = createNextAuthApiHandler({ nextAuth });

    const signInResponse = await handler(
      new Request("http://localhost/api/auth/sign-in-with-email", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "user-agent": "vitest-agent",
          "x-forwarded-for": "203.0.113.42",
        },
        body: JSON.stringify({
          email: "demo@example.com",
          password: "password123",
        }),
      })
    );

    expect(signInResponse.status).toBe(200);
    expect(lastSignInInput.value).toEqual({
      email: "demo@example.com",
      userAgent: "vitest-agent",
    });

    const signInSetCookie = signInResponse.headers.get("set-cookie");
    expect(signInSetCookie).toContain("cz_session=");
    const token = parseCookieValue(signInSetCookie, "cz_session");
    expect(token).toBe("token_1");

    const signInPayload = (await signInResponse.json()) as {
      session?: { userId: string; sessionId: string };
    };
    expect(signInPayload.session).toEqual({
      userId: "u_demo",
      sessionId: "s_1",
    });

    const cookieHeader = `cz_session=${encodeURIComponent(token ?? "")}`;

    const sessionResponse = await handler(
      new Request("http://localhost/api/auth/session", {
        method: "GET",
        headers: {
          cookie: cookieHeader,
        },
      })
    );
    expect(sessionResponse.status).toBe(200);
    expect(await sessionResponse.json()).toEqual({
      session: {
        userId: "u_demo",
        sessionId: "s_1",
      },
    });

    const tokenResponse = await handler(
      new Request("http://localhost/api/auth/token", {
        method: "GET",
        headers: {
          cookie: cookieHeader,
        },
      })
    );
    expect(tokenResponse.status).toBe(200);
    expect(tokenResponse.headers.get("cache-control")).toBe("no-store");
    expect(await tokenResponse.json()).toEqual({ token: "token_1" });

    const signOutResponse = await handler(
      new Request("http://localhost/api/auth/sign-out", {
        method: "POST",
        headers: {
          cookie: cookieHeader,
        },
      })
    );
    expect(signOutResponse.status).toBe(200);
    expect(signOutResponse.headers.get("set-cookie")).toContain("Max-Age=0");

    const sessionAfterSignOutResponse = await handler(
      new Request("http://localhost/api/auth/session", {
        method: "GET",
        headers: {
          cookie: cookieHeader,
        },
      })
    );
    expect(await sessionAfterSignOutResponse.json()).toEqual({ session: null });
  });

  it("forbids non-same-origin POST requests by default", async () => {
    const primitives = createSessionPrimitives({
      signIn: async () => ({ sessionToken: "token_1", userId: "u_demo" }),
      validateSession: async () => ({ userId: "u_demo", sessionId: "s_1" }),
      signOut: async () => {},
    });

    const nextAuth = createNextServerAuth({ primitives });
    const handler = createNextAuthApiHandler({ nextAuth });

    const response = await handler(
      new Request("http://localhost/api/auth/sign-in-with-email", {
        method: "POST",
        headers: {
          origin: "https://malicious.example",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          email: "demo@example.com",
          password: "password123",
        }),
      })
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Forbidden origin" });
  });

  it("uses forwarded IP headers only when trustedProxy is true", async () => {
    const signInSpy = vi.fn(async () => ({ sessionToken: "token_1", userId: "u_demo" }));
    const primitives = createSessionPrimitives({
      signIn: signInSpy,
      validateSession: async () => ({ userId: "u_demo", sessionId: "s_1" }),
      signOut: async () => {},
    });

    const nextAuth = createNextServerAuth({ primitives });
    const handler = createNextAuthApiHandler({
      nextAuth,
      trustedProxy: true,
    });

    const response = await handler(
      new Request("http://localhost/api/auth/sign-in-with-email", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "203.0.113.7, 10.0.0.1",
        },
        body: JSON.stringify({
          email: "demo@example.com",
          password: "password123",
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(signInSpy).toHaveBeenCalledWith({
      email: "demo@example.com",
      password: "password123",
      ipAddress: "203.0.113.7",
    });
  });

  it("supports trustedProxy predicate", async () => {
    const signInSpy = vi.fn(async () => ({ sessionToken: "token_1", userId: "u_demo" }));
    const primitives = createSessionPrimitives({
      signIn: signInSpy,
      validateSession: async () => ({ userId: "u_demo", sessionId: "s_1" }),
      signOut: async () => {},
    });

    const nextAuth = createNextServerAuth({ primitives });
    const handler = createNextAuthApiHandler({
      nextAuth,
      trustedProxy: (request) => request.headers.get("x-proxy-trusted") === "1",
    });

    await handler(
      new Request("http://localhost/api/auth/sign-in-with-email", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "198.51.100.10",
        },
        body: JSON.stringify({
          email: "demo@example.com",
          password: "password123",
        }),
      })
    );
    await handler(
      new Request("http://localhost/api/auth/sign-in-with-email", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "198.51.100.11",
          "x-proxy-trusted": "1",
        },
        body: JSON.stringify({
          email: "demo@example.com",
          password: "password123",
        }),
      })
    );

    expect(signInSpy.mock.calls[0]?.[0]).toEqual({
      email: "demo@example.com",
      password: "password123",
    });
    expect(signInSpy.mock.calls[1]?.[0]).toEqual({
      email: "demo@example.com",
      password: "password123",
      ipAddress: "198.51.100.11",
    });
  });

  it("accepts custom getClientIp resolver", async () => {
    const signInSpy = vi.fn(async () => ({ sessionToken: "token_1", userId: "u_demo" }));
    const primitives = createSessionPrimitives({
      signIn: signInSpy,
      validateSession: async () => ({ userId: "u_demo", sessionId: "s_1" }),
      signOut: async () => {},
    });

    const nextAuth = createNextServerAuth({ primitives });
    const handler = createNextAuthApiHandler({
      nextAuth,
      getClientIp: (request) => request.headers.get("x-client-ip") ?? undefined,
    });

    const response = await handler(
      new Request("http://localhost/api/auth/sign-in-with-email", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-client-ip": "192.0.2.15",
        },
        body: JSON.stringify({
          email: "demo@example.com",
          password: "password123",
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(signInSpy).toHaveBeenCalledWith({
      email: "demo@example.com",
      password: "password123",
      ipAddress: "192.0.2.15",
    });
  });

  it("parses RFC 7239 Forwarded header when trusted", async () => {
    const signInSpy = vi.fn(async () => ({ sessionToken: "token_1", userId: "u_demo" }));
    const primitives = createSessionPrimitives({
      signIn: signInSpy,
      validateSession: async () => ({ userId: "u_demo", sessionId: "s_1" }),
      signOut: async () => {},
    });

    const nextAuth = createNextServerAuth({ primitives });
    const handler = createNextAuthApiHandler({
      nextAuth,
      trustedProxy: true,
    });

    const response = await handler(
      new Request("http://localhost/api/auth/sign-in-with-email", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          forwarded: 'for="[2001:db8:cafe::17]:4711";proto=https',
        },
        body: JSON.stringify({
          email: "demo@example.com",
          password: "password123",
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(signInSpy).toHaveBeenCalledWith({
      email: "demo@example.com",
      password: "password123",
      ipAddress: "2001:db8:cafe::17",
    });
  });

  it("allows configured trustedOrigins", async () => {
    const signInSpy = vi.fn(async () => ({ sessionToken: "token_1", userId: "u_demo" }));
    const primitives = createSessionPrimitives({
      signIn: signInSpy,
      validateSession: async () => ({ userId: "u_demo", sessionId: "s_1" }),
      signOut: async () => {},
    });

    const nextAuth = createNextServerAuth({ primitives });
    const handler = createNextAuthApiHandler({
      nextAuth,
      trustedOrigins: ["https://admin.example.com"],
    });

    const response = await handler(
      new Request("http://localhost/api/auth/sign-in-with-email", {
        method: "POST",
        headers: {
          origin: "https://admin.example.com",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          email: "demo@example.com",
          password: "password123",
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(signInSpy).toHaveBeenCalledTimes(1);
  });

  it("supports dynamic trustedOrigins resolver", async () => {
    const signInSpy = vi.fn(async () => ({ sessionToken: "token_1", userId: "u_demo" }));
    const primitives = createSessionPrimitives({
      signIn: signInSpy,
      validateSession: async () => ({ userId: "u_demo", sessionId: "s_1" }),
      signOut: async () => {},
    });

    const nextAuth = createNextServerAuth({ primitives });
    const handler = createNextAuthApiHandler({
      nextAuth,
      trustedOrigins: (request) => {
        if (request.headers.get("x-env") === "preview") {
          return ["https://preview.example.com"];
        }
        return [];
      },
    });

    const blocked = await handler(
      new Request("http://localhost/api/auth/sign-in-with-email", {
        method: "POST",
        headers: {
          origin: "https://preview.example.com",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          email: "demo@example.com",
          password: "password123",
        }),
      })
    );
    expect(blocked.status).toBe(403);

    const allowed = await handler(
      new Request("http://localhost/api/auth/sign-in-with-email", {
        method: "POST",
        headers: {
          origin: "https://preview.example.com",
          "x-env": "preview",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          email: "demo@example.com",
          password: "password123",
        }),
      })
    );
    expect(allowed.status).toBe(200);
  });

  it("starts OAuth via GET /api/auth/sign-in/:provider in json mode", async () => {
    const fetchMutation = vi.fn(async () => ({
      authorizationUrl:
        "https://accounts.google.com/o/oauth2/v2/auth?state=oauth-state-123",
    }));
    const auth = {
      getSession: vi.fn(async () => null),
      getToken: vi.fn(async () => null),
      signIn: vi.fn(),
      establishSession: vi.fn(),
      signOut: vi.fn(),
    };
    const getOAuthUrlRef = {} as FunctionReference<"mutation", "public">;
    const handleOAuthCallbackRef = {} as FunctionReference<"action", "public">;
    const handler = createNextAuthApiHandler({
      nextAuth: auth,
      convexFunctions: {
        core: {
          getOAuthUrl: getOAuthUrlRef,
          handleOAuthCallback: handleOAuthCallbackRef,
        },
      },
      fetchers: { fetchAction: vi.fn(), fetchMutation },
    });

    const response = await handler(
      new Request(
        "http://localhost/api/auth/sign-in/google?mode=json&redirectTo=%2Fdashboard&errorRedirectTo=%2Fsignin",
        { method: "GET" }
      )
    );

    expect(response.status).toBe(200);
    expect(fetchMutation).toHaveBeenCalledWith(getOAuthUrlRef, {
      providerId: "google",
      callbackUrl: "http://localhost/api/auth/callback/google",
      redirectTo: "/dashboard",
      errorRedirectTo: "/signin",
    });
    await expect(response.json()).resolves.toEqual({
      authorizationUrl:
        "https://accounts.google.com/o/oauth2/v2/auth?state=oauth-state-123",
    });
    expect(response.headers.get("set-cookie")).toContain("cz_oauth_state=");
  });

  it("redirects OAuth sign-in to the configured broker origin", async () => {
    const handler = createNextAuthApiHandler({
      nextAuth: {
        getSession: vi.fn(async () => null),
        getToken: vi.fn(async () => null),
        signIn: vi.fn(),
        establishSession: vi.fn(),
        signOut: vi.fn(),
      },
      oauthProxy: {
        brokerOrigin: "https://auth.example.com",
      },
      convexFunctions: {
        core: {
          getOAuthUrl: {} as FunctionReference<"mutation", "public">,
          handleOAuthCallback: {} as FunctionReference<"action", "public">,
          handleOAuthProxyCallback: {} as FunctionReference<"action", "public">,
          exchangeOAuthProxyCode: {} as FunctionReference<"action", "public">,
        },
      },
      fetchers: { fetchAction: vi.fn(), fetchMutation: vi.fn() },
    });

    const response = await handler(
      new Request(
        "http://localhost/api/auth/sign-in/google?mode=json&redirectTo=%2Fdashboard&errorRedirectTo=%2Fsignin",
        { method: "GET" }
      )
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      authorizationUrl:
        "https://auth.example.com/api/auth/proxy/sign-in/google?returnTarget=http%3A%2F%2Flocalhost%2Fapi%2Fauth%2Fproxy%2Fexchange&redirectTo=%2Fdashboard&errorRedirectTo=%2Fsignin",
    });
  });

  it("rejects disallowed OAuth proxy return targets on the broker route", async () => {
    const handler = createNextAuthApiHandler({
      nextAuth: {
        getSession: vi.fn(async () => null),
        getToken: vi.fn(async () => null),
        signIn: vi.fn(),
        establishSession: vi.fn(),
        signOut: vi.fn(),
      },
      oauthProxy: {
        allowedReturnTargets: [{ type: "webUrl", url: "https://app.example.com" }],
      },
      convexFunctions: {
        core: {
          getOAuthUrl: {} as FunctionReference<"mutation", "public">,
          handleOAuthCallback: {} as FunctionReference<"action", "public">,
          handleOAuthProxyCallback: {} as FunctionReference<"action", "public">,
          exchangeOAuthProxyCode: {} as FunctionReference<"action", "public">,
        },
      },
      fetchers: { fetchAction: vi.fn(), fetchMutation: vi.fn() },
    });

    const response = await handler(
      new Request(
        "https://auth.example.com/api/auth/proxy/sign-in/google?returnTarget=https%3A%2F%2Fevil.example.com%2Fapi%2Fauth%2Fproxy%2Fexchange",
        { method: "GET" }
      )
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error:
        "OAuth proxy return target is not allowed: https://evil.example.com/api/auth/proxy/exchange",
    });
  });

  it("rejects broker proxy sign-in when no allowed return targets are configured", async () => {
    const handler = createNextAuthApiHandler({
      nextAuth: {
        getSession: vi.fn(async () => null),
        getToken: vi.fn(async () => null),
        signIn: vi.fn(),
        establishSession: vi.fn(),
        signOut: vi.fn(),
      },
      oauthProxy: {},
      convexFunctions: {
        core: {
          getOAuthUrl: {} as FunctionReference<"mutation", "public">,
          handleOAuthCallback: {} as FunctionReference<"action", "public">,
          handleOAuthProxyCallback: {} as FunctionReference<"action", "public">,
          exchangeOAuthProxyCode: {} as FunctionReference<"action", "public">,
        },
      },
      fetchers: { fetchAction: vi.fn(), fetchMutation: vi.fn() },
    });

    const response = await handler(
      new Request(
        "https://auth.example.com/api/auth/proxy/sign-in/google?returnTarget=https%3A%2F%2Fapp.example.com%2Fapi%2Fauth%2Fproxy%2Fexchange",
        { method: "GET" }
      )
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "OAuth proxy broker has no allowed return targets configured",
    });
  });

  it("rejects unsafe OAuth redirect targets", async () => {
    const handler = createNextAuthApiHandler({
      nextAuth: {
        getSession: vi.fn(async () => null),
        getToken: vi.fn(async () => null),
        signIn: vi.fn(),
        establishSession: vi.fn(),
        signOut: vi.fn(),
      },
      convexFunctions: {
        core: {
          getOAuthUrl: {} as FunctionReference<"mutation", "public">,
          handleOAuthCallback: {} as FunctionReference<"action", "public">,
        },
      },
      fetchers: { fetchAction: vi.fn(), fetchMutation: vi.fn() },
    });

    const response = await handler(
      new Request(
        "http://localhost/api/auth/sign-in/google?mode=json&redirectTo=https%3A%2F%2Fevil.example%2Fsteal",
        { method: "GET" }
      )
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "OAuth redirect targets must be relative paths",
    });

    const backslashResponse = await handler(
      new Request(
        "http://localhost/api/auth/sign-in/google?mode=json&redirectTo=%2F%5Cevil.example%2Fsteal",
        { method: "GET" }
      )
    );

    expect(backslashResponse.status).toBe(400);
    await expect(backslashResponse.json()).resolves.toEqual({
      error: "OAuth redirect targets must be relative paths",
    });
  });

  it("completes OAuth callbacks and establishes the normal session cookie", async () => {
    const fetchAction = vi.fn(async () => ({
      sessionToken: "raw-session-token",
      redirectTo: "/dashboard",
    }));
    const auth = {
      getSession: vi.fn(async () => null),
      getToken: vi.fn(async () => null),
      signIn: vi.fn(),
      establishSession: vi.fn(async () => ({
        session: { userId: "u_demo", sessionId: "s_oauth" },
        token: "encoded-session-token",
        setCookie: "cz_session=encoded-session-token; Path=/; HttpOnly; SameSite=lax",
      })),
      signOut: vi.fn(),
    };
    const getOAuthUrlRef = {} as FunctionReference<"mutation", "public">;
    const handleOAuthCallbackRef = {} as FunctionReference<"action", "public">;
    const stateCookie = encodeURIComponent(
      JSON.stringify({
        state: "oauth-state-123",
        providerId: "google",
        redirectTo: "/dashboard",
        errorRedirectTo: "/signin",
      })
    );
    const handler = createNextAuthApiHandler({
      nextAuth: auth,
      trustedProxy: true,
      convexFunctions: {
        core: {
          getOAuthUrl: getOAuthUrlRef,
          handleOAuthCallback: handleOAuthCallbackRef,
        },
      },
      fetchers: { fetchAction, fetchMutation: vi.fn() },
    });

    const response = await handler(
      new Request(
        "http://localhost/api/auth/callback/google?code=oauth-code&state=oauth-state-123",
        {
          method: "GET",
          headers: {
            cookie: `cz_oauth_state=${stateCookie}`,
            "user-agent": "oauth-test-agent",
            "x-forwarded-for": "203.0.113.8",
          },
        }
      )
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("http://localhost/dashboard");
    expect(fetchAction).toHaveBeenCalledWith(handleOAuthCallbackRef, {
      providerId: "google",
      code: "oauth-code",
      state: "oauth-state-123",
      callbackUrl: "http://localhost/api/auth/callback/google",
      ipAddress: "203.0.113.8",
      userAgent: "oauth-test-agent",
    });
    expect(auth.establishSession).toHaveBeenCalledWith("raw-session-token");
    const setCookieHeader = response.headers.get("set-cookie");
    expect(setCookieHeader).toContain("cz_session=encoded-session-token");
    expect(setCookieHeader).toContain("cz_oauth_state=");
    expect(setCookieHeader).toContain("Max-Age=0");
  });

  it("completes brokered OAuth callbacks without establishing a broker session", async () => {
    const fetchAction = vi.fn(async () => ({
      code: "proxy_exchange_123",
      userId: "u_demo",
      redirectTo: "/dashboard",
    }));
    const auth = {
      getSession: vi.fn(async () => null),
      getToken: vi.fn(async () => null),
      signIn: vi.fn(),
      establishSession: vi.fn(),
      signOut: vi.fn(),
    };
    const handler = createNextAuthApiHandler({
      nextAuth: auth,
      convexFunctions: {
        core: {
          getOAuthUrl: {} as FunctionReference<"mutation", "public">,
          handleOAuthCallback: {} as FunctionReference<"action", "public">,
          handleOAuthProxyCallback: {} as FunctionReference<"action", "public">,
          exchangeOAuthProxyCode: {} as FunctionReference<"action", "public">,
        },
      },
      fetchers: { fetchAction, fetchMutation: vi.fn() },
    });

    const stateCookie = encodeURIComponent(
      JSON.stringify({
        mode: "proxy",
        state: "oauth-state-123",
        providerId: "google",
        redirectTo: "/dashboard",
        errorRedirectTo: "/signin",
        returnTarget: "https://preview-123.example.app/api/auth/proxy/exchange",
      })
    );

    const response = await handler(
      new Request(
        "https://auth.example.com/api/auth/callback/google?code=oauth-code&state=oauth-state-123",
        {
          method: "GET",
          headers: {
            cookie: `cz_oauth_state=${stateCookie}`,
          },
        }
      )
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "https://preview-123.example.app/api/auth/proxy/exchange?oauth_proxy_code=proxy_exchange_123"
    );
    expect(fetchAction).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        providerId: "google",
        code: "oauth-code",
        state: "oauth-state-123",
        callbackUrl: "https://auth.example.com/api/auth/callback/google",
      })
    );
    expect(auth.establishSession).not.toHaveBeenCalled();
  });

  it("exchanges OAuth proxy codes and establishes the consumer session", async () => {
    const fetchAction = vi.fn(async () => ({
      sessionToken: "raw-session-token",
      userId: "u_demo",
      redirectTo: "/dashboard",
    }));
    const auth = {
      getSession: vi.fn(async () => null),
      getToken: vi.fn(async () => null),
      signIn: vi.fn(),
      establishSession: vi.fn(async () => ({
        session: { userId: "u_demo", sessionId: "s_proxy" },
        token: "encoded-session-token",
        setCookie: "cz_session=encoded-session-token; Path=/; HttpOnly; SameSite=lax",
      })),
      signOut: vi.fn(),
    };
    const exchangeOAuthProxyCodeRef = {} as FunctionReference<"action", "public">;
    const handler = createNextAuthApiHandler({
      nextAuth: auth,
      convexFunctions: {
        core: {
          getOAuthUrl: {} as FunctionReference<"mutation", "public">,
          handleOAuthCallback: {} as FunctionReference<"action", "public">,
          handleOAuthProxyCallback: {} as FunctionReference<"action", "public">,
          exchangeOAuthProxyCode: exchangeOAuthProxyCodeRef,
        },
      },
      fetchers: { fetchAction, fetchMutation: vi.fn() },
    });

    const response = await handler(
      new Request(
        "https://preview-123.example.app/api/auth/proxy/exchange?oauth_proxy_code=proxy_exchange_123&errorRedirectTo=%2Fsignin",
        {
          method: "GET",
          headers: {
            "user-agent": "oauth-proxy-agent",
          },
        }
      )
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(
      "https://preview-123.example.app/dashboard"
    );
    expect(fetchAction).toHaveBeenCalledWith(exchangeOAuthProxyCodeRef, {
      code: "proxy_exchange_123",
      userAgent: "oauth-proxy-agent",
    });
    expect(auth.establishSession).toHaveBeenCalledWith("raw-session-token");
    expect(response.headers.get("set-cookie")).toContain(
      "cz_session=encoded-session-token"
    );
  });

  it("createNextServerAuthWithHandler wires a ready-to-use handler", async () => {
    const signInSpy = vi.fn(async () => ({ sessionToken: "token_1", userId: "u_demo" }));
    const primitives = createSessionPrimitives({
      signIn: signInSpy,
      validateSession: async () => ({ userId: "u_demo", sessionId: "s_1" }),
      signOut: async () => {},
    });

    const nextAuth = createNextServerAuthWithHandler({ primitives });

    const response = await nextAuth.handler(
      new Request("http://localhost/api/auth/sign-in-with-email", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          email: "demo@example.com",
          password: "password123",
          userAgent: "custom-agent",
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(signInSpy).toHaveBeenCalledWith({
      email: "demo@example.com",
      password: "password123",
      userAgent: "custom-agent",
    });
  });
});
