import { describe, expect, it, vi } from "vitest";
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
