import { describe, expect, it, vi } from "vitest";
import { createAuthTokenManager } from "../src/client/auth-token-manager";

describe("createAuthTokenManager", () => {
  it("caches token values until forceRefresh", async () => {
    let callCount = 0;
    const manager = createAuthTokenManager({
      fetchToken: async () => {
        callCount += 1;
        return { token: `token_${callCount}` };
      },
    });

    await expect(manager.getToken()).resolves.toBe("token_1");
    await expect(manager.getToken()).resolves.toBe("token_1");
    await expect(manager.getToken({ forceRefresh: true })).resolves.toBe("token_2");
    expect(callCount).toBe(2);
  });

  it("clears and invalidates cached token state", async () => {
    let callCount = 0;
    const manager = createAuthTokenManager({
      fetchToken: async () => {
        callCount += 1;
        return { token: `token_${callCount}` };
      },
    });

    await expect(manager.getToken()).resolves.toBe("token_1");
    manager.clear();
    await expect(manager.getToken()).resolves.toBe("token_2");
    manager.invalidate("test");
    await expect(manager.getToken()).resolves.toBe("token_3");
    expect(callCount).toBe(3);
  });

  it("deduplicates concurrent token fetches when not force refreshing", async () => {
    let resolveFetch: ((payload: { token: string }) => void) | undefined;
    const fetchToken = vi.fn(
      () =>
        new Promise<{ token: string }>((resolve) => {
          resolveFetch = resolve;
        })
    );
    const manager = createAuthTokenManager({ fetchToken });

    const first = manager.getToken();
    const second = manager.getToken();
    expect(fetchToken).toHaveBeenCalledTimes(1);

    resolveFetch?.({ token: "token_1" });
    await expect(first).resolves.toBe("token_1");
    await expect(second).resolves.toBe("token_1");
  });

  it("refreshes cached tokens when they are near expiry", async () => {
    let nowMs = 1_000;
    const fetchToken = vi
      .fn()
      .mockResolvedValueOnce({ token: "token_1", expiresAtMs: 40_000 })
      .mockResolvedValueOnce({ token: "token_2", expiresAtMs: 80_000 });
    const manager = createAuthTokenManager({
      fetchToken,
      now: () => nowMs,
      refreshSkewMs: 30_000,
    });

    await expect(manager.getToken()).resolves.toBe("token_1");
    nowMs = 12_000;
    await expect(manager.getToken()).resolves.toBe("token_2");
    expect(fetchToken).toHaveBeenCalledTimes(2);
  });

  it("emits lifecycle events", async () => {
    const manager = createAuthTokenManager({
      fetchToken: async () => ({ token: "token_1", issuedAtMs: 10, expiresAtMs: 20 }),
    });
    const events: string[] = [];
    const unsubscribe = manager.subscribe((event) => {
      events.push(event.type);
    });

    await manager.getToken();
    manager.invalidate("test");
    manager.clear();
    unsubscribe();

    expect(events).toEqual(["updated", "invalidated", "cleared"]);
  });

  it("supports priming cached payloads", async () => {
    let callCount = 0;
    const manager = createAuthTokenManager({
      fetchToken: async () => {
        callCount += 1;
        return { token: `token_${callCount}` };
      },
    });

    manager.prime({ token: "primed_token" });
    await expect(manager.getToken()).resolves.toBe("primed_token");
    expect(callCount).toBe(0);
  });
});
