import { describe, expect, it, vi } from "vitest";
import {
  createAuthRuntime,
  createMemoryAuthStorage,
} from "../src/client/auth-runtime";

describe("createAuthRuntime", () => {
  it("hydrates token from storage before fetching", async () => {
    const storage = createMemoryAuthStorage();
    await storage.set({ token: "stored_token" });
    const tokenProvider = vi.fn(async () => ({ token: "fresh_token" }));
    const runtime = createAuthRuntime({
      tokenProvider: {
        getToken: tokenProvider,
      },
      storage,
    });

    await expect(runtime.getToken()).resolves.toBe("stored_token");
    expect(tokenProvider).not.toHaveBeenCalled();
  });

  it("bounds unauthorized refresh retries", async () => {
    let callCount = 0;
    const runtime = createAuthRuntime({
      tokenProvider: {
        getToken: async () => {
          callCount += 1;
          return { token: `token_${callCount}` };
        },
      },
      maxUnauthorizedRefreshRetries: 1,
    });

    await expect(runtime.getToken()).resolves.toBe("token_1");
    await runtime.onUnauthorized();
    await expect(runtime.getToken()).resolves.toBe("token_2");
    await runtime.onUnauthorized();
    await expect(runtime.getToken()).resolves.toBeNull();
  });

  it("mounts convex auth clients and reconnects on sign-in/sign-out", async () => {
    const runtime = createAuthRuntime({
      tokenProvider: {
        getToken: async () => ({ token: "token_1" }),
      },
    });
    const convexClient = {
      setAuth: vi.fn(),
      clearAuth: vi.fn(),
    };

    const disconnect = runtime.mountConvex(convexClient);
    expect(convexClient.setAuth).toHaveBeenCalledTimes(1);
    expect(convexClient.clearAuth).toHaveBeenCalledTimes(0);

    await runtime.onSignedIn();
    expect(convexClient.setAuth).toHaveBeenCalledTimes(2);
    expect(convexClient.clearAuth).toHaveBeenCalledTimes(1);

    await runtime.onSignedOut();
    expect(convexClient.setAuth).toHaveBeenCalledTimes(3);
    expect(convexClient.clearAuth).toHaveBeenCalledTimes(2);

    disconnect();
    expect(convexClient.clearAuth).toHaveBeenCalledTimes(3);
  });
});
