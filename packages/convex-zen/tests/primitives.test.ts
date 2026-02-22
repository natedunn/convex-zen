import { describe, expect, it, vi } from "vitest";
import { SessionPrimitives, type SessionTransport } from "../src/client/primitives";

function createTransport(overrides?: Partial<SessionTransport>): SessionTransport {
  const base: SessionTransport = {
    signIn: async () => ({
      sessionToken: "token-1",
      userId: "user-1",
    }),
    validateSession: async (token) =>
      token === "token-1"
        ? {
            userId: "user-1",
            sessionId: "session-1",
          }
        : null,
    signOut: async () => {},
  };
  return {
    ...base,
    ...overrides,
  };
}

describe("SessionPrimitives", () => {
  it("returns null when token is missing", async () => {
    const primitives = new SessionPrimitives(createTransport());
    await expect(primitives.getSessionFromToken(undefined)).resolves.toBeNull();
    await expect(primitives.getSessionFromToken(null)).resolves.toBeNull();
    await expect(primitives.getSessionFromToken("")).resolves.toBeNull();
  });

  it("requires a valid session token", async () => {
    const primitives = new SessionPrimitives(createTransport());
    await expect(
      primitives.requireSessionFromToken("not-valid")
    ).rejects.toThrow("Unauthorized");
  });

  it("signs in and resolves session", async () => {
    const transport = createTransport();
    const signInSpy = vi.spyOn(transport, "signIn");
    const validateSpy = vi.spyOn(transport, "validateSession");
    const primitives = new SessionPrimitives(transport);

    const result = await primitives.signInAndResolveSession({
      email: "user@example.com",
      password: "Password123!",
    });

    expect(result.sessionToken).toBe("token-1");
    expect(result.session.userId).toBe("user-1");
    expect(signInSpy).toHaveBeenCalledTimes(1);
    expect(validateSpy).toHaveBeenCalledWith("token-1");
  });

  it("throws if sign-in token cannot be validated", async () => {
    const primitives = new SessionPrimitives(
      createTransport({
        validateSession: async () => null,
      })
    );

    await expect(
      primitives.signInAndResolveSession({
        email: "user@example.com",
        password: "Password123!",
      })
    ).rejects.toThrow("Could not validate newly created session");
  });

  it("does not sign out when token is missing", async () => {
    const transport = createTransport();
    const signOutSpy = vi.spyOn(transport, "signOut");
    const primitives = new SessionPrimitives(transport);

    await primitives.signOutByToken(undefined);
    await primitives.signOutByToken(null);
    await primitives.signOutByToken("");

    expect(signOutSpy).not.toHaveBeenCalled();
  });

  it("signs out when token is present", async () => {
    const transport = createTransport();
    const signOutSpy = vi.spyOn(transport, "signOut");
    const primitives = new SessionPrimitives(transport);

    await primitives.signOutByToken("token-1");
    expect(signOutSpy).toHaveBeenCalledWith("token-1");
  });
});
