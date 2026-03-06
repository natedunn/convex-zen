import { describe, expect, it } from "vitest";
import type { FunctionReference } from "convex/server";
import type { SessionTokenCodec } from "../src/client/tanstack-start-identity-jwt";
import {
  createRequestFromHeaders,
  createNextAuthServerFactory,
  resolveNextTrustedOriginsFromEnv,
} from "../src/client/next";

function mutationRef(name: string): FunctionReference<"mutation", "public"> {
  return { name } as unknown as FunctionReference<"mutation", "public">;
}

const passthroughCodec: SessionTokenCodec = {
  encode: async (value) => value.sessionToken,
  decode: async (token) => ({ userId: "u_test", sessionToken: token }),
};

describe("resolveNextTrustedOriginsFromEnv", () => {
  it("normalizes and deduplicates configured origins", () => {
    const trustedOrigins = resolveNextTrustedOriginsFromEnv({
      env: {
        CONVEX_SITE_URL: "http://example.com/path",
        NEXT_PUBLIC_APP_ORIGIN:
          "https://app.example.com, https://app.example.com/login, invalid-url",
      },
      defaults: ["http://localhost:3000", "http://localhost:3000/home"],
    });

    expect(trustedOrigins).toEqual([
      "http://localhost:3000",
      "http://example.com",
      "https://app.example.com",
    ]);
  });
});

describe("createRequestFromHeaders", () => {
  it("uses forwarded host/proto headers when present", () => {
    const request = createRequestFromHeaders({
      headers: new Headers({
        "x-forwarded-host": "next.convex-zen.localhost:1355",
        "x-forwarded-proto": "http",
      }),
      pathname: "/dashboard",
    });

    expect(request.url).toBe("http://next.convex-zen.localhost:1355/dashboard");
  });
});

describe("createNextAuthServerFactory", () => {
  it("returns a clear 500 response when convex URL is missing", async () => {
    const factory = createNextAuthServerFactory({
      env: {},
      convexFunctions: {
        signInWithEmail: mutationRef("auth.signInWithEmail"),
        validateSession: mutationRef("auth.validateSession"),
        invalidateSession: mutationRef("auth.invalidateSession"),
      },
      sessionTokenCodec: passthroughCodec,
    });

    const response = await factory.handler(
      new Request("http://localhost/api/auth/session", {
        method: "GET",
      })
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Missing NEXT_PUBLIC_CONVEX_URL. Configure it in your app environment.",
    });

    await expect(
      factory.requireSession(
        new Request("http://localhost/dashboard", {
          method: "GET",
        })
      )
    ).rejects.toThrow(
      "Missing NEXT_PUBLIC_CONVEX_URL. Configure it in your app environment."
    );

    await expect(
      factory.getToken(
        new Request("http://localhost/dashboard", {
          method: "GET",
        })
      )
    ).rejects.toThrow(
      "Missing NEXT_PUBLIC_CONVEX_URL. Configure it in your app environment."
    );

    await expect(
      factory.getSession(
        new Request("http://localhost/dashboard", {
          method: "GET",
        })
      )
    ).rejects.toThrow(
      "Missing NEXT_PUBLIC_CONVEX_URL. Configure it in your app environment."
    );
  });

  it("trusts cross-origin POST requests when origin is configured via env", async () => {
    const factory = createNextAuthServerFactory({
      env: {
        NEXT_PUBLIC_CONVEX_URL: "https://example.convex.cloud",
        CONVEX_SITE_URL: "http://allowed.example",
      },
      convexFunctions: {
        signInWithEmail: mutationRef("auth.signInWithEmail"),
        validateSession: mutationRef("auth.validateSession"),
        invalidateSession: mutationRef("auth.invalidateSession"),
      },
      sessionTokenCodec: passthroughCodec,
    });

    const response = await factory.handler(
      new Request("http://localhost/api/auth/sign-out", {
        method: "POST",
        headers: {
          origin: "http://allowed.example",
        },
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("does not auto-trust env origins when trustedOriginsFromEnv is false", async () => {
    const factory = createNextAuthServerFactory({
      env: {
        NEXT_PUBLIC_CONVEX_URL: "https://example.convex.cloud",
        CONVEX_SITE_URL: "http://allowed.example",
      },
      trustedOriginsFromEnv: false,
      convexFunctions: {
        signInWithEmail: mutationRef("auth.signInWithEmail"),
        validateSession: mutationRef("auth.validateSession"),
        invalidateSession: mutationRef("auth.invalidateSession"),
      },
      sessionTokenCodec: passthroughCodec,
    });

    const response = await factory.handler(
      new Request("http://localhost/api/auth/sign-out", {
        method: "POST",
        headers: {
          origin: "http://allowed.example",
        },
      })
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Forbidden origin" });
  });
});
