import { describe, expect, it, vi } from "vitest";
import { createTanStackStartAuthApiHandler } from "../src/client/tanstack-start";
import type { SessionInfo, SignInInput } from "../src/client/primitives";

function makeSession(): SessionInfo {
  return { userId: "user_1", sessionId: "session_1" };
}

function createAuthMocks() {
  return {
    getSession: vi.fn(async () => null),
    signIn: vi.fn(async (_input: SignInInput) => makeSession()),
    signOut: vi.fn(async () => {}),
  };
}

function makeSignInRequest(headers: Record<string, string> = {}): Request {
  return new Request("https://app.test/api/auth/sign-in-with-email", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify({
      email: "user@example.com",
      password: "Password123!",
    }),
  });
}

describe("createTanStackStartAuthApiHandler client IP handling", () => {
  it("does not trust forwarded IP headers by default", async () => {
    const auth = createAuthMocks();
    const handler = createTanStackStartAuthApiHandler({ tanstackAuth: auth });

    const response = await handler(
      makeSignInRequest({ "x-forwarded-for": "203.0.113.9" })
    );

    expect(response.status).toBe(200);
    expect(auth.signIn).toHaveBeenCalledTimes(1);
    const firstArg = auth.signIn.mock.calls[0]?.[0];
    expect(firstArg?.ipAddress).toBeUndefined();
  });

  it("uses forwarded IP headers only when trustedProxy is true", async () => {
    const auth = createAuthMocks();
    const handler = createTanStackStartAuthApiHandler({
      tanstackAuth: auth,
      trustedProxy: true,
    });

    await handler(
      makeSignInRequest({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" })
    );

    const firstArg = auth.signIn.mock.calls[0]?.[0];
    expect(firstArg?.ipAddress).toBe("203.0.113.7");
  });

  it("supports trustedProxy predicate", async () => {
    const auth = createAuthMocks();
    const handler = createTanStackStartAuthApiHandler({
      tanstackAuth: auth,
      trustedProxy: (request) => request.headers.get("x-proxy-trusted") === "1",
    });

    await handler(
      makeSignInRequest({
        "x-forwarded-for": "198.51.100.10",
      })
    );
    await handler(
      makeSignInRequest({
        "x-forwarded-for": "198.51.100.11",
        "x-proxy-trusted": "1",
      })
    );

    const firstArg = auth.signIn.mock.calls[0]?.[0];
    const secondArg = auth.signIn.mock.calls[1]?.[0];
    expect(firstArg?.ipAddress).toBeUndefined();
    expect(secondArg?.ipAddress).toBe("198.51.100.11");
  });

  it("accepts custom getClientIp resolver", async () => {
    const auth = createAuthMocks();
    const handler = createTanStackStartAuthApiHandler({
      tanstackAuth: auth,
      getClientIp: (request) => request.headers.get("x-client-ip") ?? undefined,
    });

    await handler(makeSignInRequest({ "x-client-ip": "192.0.2.15" }));

    const firstArg = auth.signIn.mock.calls[0]?.[0];
    expect(firstArg?.ipAddress).toBe("192.0.2.15");
  });

  it("parses RFC 7239 Forwarded header when trusted", async () => {
    const auth = createAuthMocks();
    const handler = createTanStackStartAuthApiHandler({
      tanstackAuth: auth,
      trustedProxy: true,
    });

    await handler(
      makeSignInRequest({
        forwarded: 'for="[2001:db8:cafe::17]:4711";proto=https',
      })
    );

    const firstArg = auth.signIn.mock.calls[0]?.[0];
    expect(firstArg?.ipAddress).toBe("2001:db8:cafe::17");
  });
});

describe("createTanStackStartAuthApiHandler trusted origins", () => {
  it("rejects cross-origin POST by default", async () => {
    const auth = createAuthMocks();
    const handler = createTanStackStartAuthApiHandler({ tanstackAuth: auth });

    const response = await handler(
      makeSignInRequest({
        origin: "https://admin.example.com",
      })
    );

    expect(response.status).toBe(403);
    expect(auth.signIn).not.toHaveBeenCalled();
  });

  it("allows configured trustedOrigins", async () => {
    const auth = createAuthMocks();
    const handler = createTanStackStartAuthApiHandler({
      tanstackAuth: auth,
      trustedOrigins: [
        "https://admin.example.com",
        "http://localhost:3000",
        "http://localhost:5173",
      ],
    });

    const response = await handler(
      makeSignInRequest({
        origin: "http://localhost:5173",
      })
    );

    expect(response.status).toBe(200);
    expect(auth.signIn).toHaveBeenCalledTimes(1);
  });

  it("supports dynamic trustedOrigins resolver", async () => {
    const auth = createAuthMocks();
    const handler = createTanStackStartAuthApiHandler({
      tanstackAuth: auth,
      trustedOrigins: (request) => {
        if (request.headers.get("x-env") === "preview") {
          return ["https://preview.example.com"];
        }
        return [];
      },
    });

    const blocked = await handler(
      makeSignInRequest({
        origin: "https://preview.example.com",
      })
    );
    expect(blocked.status).toBe(403);

    const allowed = await handler(
      makeSignInRequest({
        origin: "https://preview.example.com",
        "x-env": "preview",
      })
    );
    expect(allowed.status).toBe(200);
  });
});
