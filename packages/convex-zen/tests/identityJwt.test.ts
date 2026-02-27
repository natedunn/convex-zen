import { describe, expect, it } from "vitest";
import { createConvexZenIdentityJwt } from "../src/client/tanstack-start-identity-jwt";

const TEST_SECRET = "convex-zen-test-secret-1234567890-abcdef";

describe("createConvexZenIdentityJwt", () => {
  it("derives deterministic public jwks from one secret", () => {
    const first = createConvexZenIdentityJwt({ secret: TEST_SECRET });
    const second = createConvexZenIdentityJwt({ secret: TEST_SECRET });

    expect(first.authProvider.algorithm).toBe("ES256");
    expect(first.publicJwks).toEqual(second.publicJwks);
    expect(first.authProvider.jwks).toEqual(second.authProvider.jwks);
  });

  it("encodes and decodes session tokens", async () => {
    const identityJwt = createConvexZenIdentityJwt({
      secret: TEST_SECRET,
      issuer: "https://example.test",
      applicationID: "convex-zen-test",
    });

    const token = await identityJwt.sessionTokenCodec.encode({
      userId: "user_123",
      sessionToken: "session_abc",
    });

    await expect(identityJwt.sessionTokenCodec.decode(token)).resolves.toEqual({
      userId: "user_123",
      sessionToken: "session_abc",
    });
  });

  it("returns null when token was signed with a different secret", async () => {
    const first = createConvexZenIdentityJwt({ secret: TEST_SECRET });
    const second = createConvexZenIdentityJwt({
      secret: "different-convex-zen-secret-1234567890",
    });

    const token = await first.sessionTokenCodec.encode({
      userId: "user_123",
      sessionToken: "session_abc",
    });

    await expect(second.sessionTokenCodec.decode(token)).resolves.toBeNull();
  });

  it("requires a sufficiently long secret", () => {
    expect(() =>
      createConvexZenIdentityJwt({
        secret: "short-secret",
      })
    ).toThrow("too short");
  });
});
