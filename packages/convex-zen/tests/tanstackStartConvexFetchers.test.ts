import { describe, expect, it, vi } from "vitest";
import type { FunctionReference } from "convex/server";
import { createTanStackStartConvexFetchers } from "../src/client/tanstack-start";

const { convexClientInstances, MockConvexHttpClient } = vi.hoisted(() => {
  const instances: Array<{
    url: string;
    setAuth: ReturnType<typeof vi.fn<(token: string) => void>>;
    query: ReturnType<typeof vi.fn>;
    mutation: ReturnType<typeof vi.fn>;
    action: ReturnType<typeof vi.fn>;
  }> = [];

  class HoistedMockConvexHttpClient {
    readonly url: string;
    readonly setAuth = vi.fn<(token: string) => void>();
    readonly query = vi.fn(async () => ({ ok: true }));
    readonly mutation = vi.fn(async () => ({ ok: true }));
    readonly action = vi.fn(async () => ({ ok: true }));

    constructor(url: string) {
      this.url = url;
      instances.push(this);
    }
  }

  return {
    convexClientInstances: instances,
    MockConvexHttpClient: HoistedMockConvexHttpClient,
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

function actionRef(name: string): FunctionReference<"action", "public"> {
  return { name } as unknown as FunctionReference<"action", "public">;
}

describe("createTanStackStartConvexFetchers", () => {
  it("uses requireSession token for authenticated fetchers", async () => {
    convexClientInstances.length = 0;
    const requireSession = vi.fn(async () => ({
      token: "token_123",
      session: { userId: "u1" },
    }));
    const fetchers = createTanStackStartConvexFetchers({
      tanstackAuth: {
        requireSession,
      },
      convexUrl: "https://example.convex.cloud",
    });
    const query = queryRef("auth.currentUser");
    const mutation = mutationRef("auth.updateProfile");
    const action = actionRef("auth.exportData");

    await fetchers.fetchAuthQuery(query, {});
    await fetchers.fetchAuthMutation(mutation, {});
    await fetchers.fetchAuthAction(action, {});

    expect(requireSession).toHaveBeenCalledTimes(3);
    expect(convexClientInstances).toHaveLength(4);
    expect(convexClientInstances[1]?.setAuth).toHaveBeenCalledWith("token_123");
    expect(convexClientInstances[1]?.query).toHaveBeenCalledWith(query, {});
    expect(convexClientInstances[2]?.setAuth).toHaveBeenCalledWith("token_123");
    expect(convexClientInstances[2]?.mutation).toHaveBeenCalledWith(mutation, {});
    expect(convexClientInstances[3]?.setAuth).toHaveBeenCalledWith("token_123");
    expect(convexClientInstances[3]?.action).toHaveBeenCalledWith(action, {});
  });

  it("keeps public fetchers unauthenticated", async () => {
    convexClientInstances.length = 0;
    const requireSession = vi.fn(async () => ({
      token: "token_123",
      session: { userId: "u1" },
    }));
    const fetchers = createTanStackStartConvexFetchers({
      tanstackAuth: {
        requireSession,
      },
      convexUrl: "https://example.convex.cloud",
    });
    const query = queryRef("public.currentUser");

    await fetchers.fetchQuery(query, {});

    expect(requireSession).not.toHaveBeenCalled();
    expect(convexClientInstances).toHaveLength(1);
    expect(convexClientInstances[0]?.setAuth).not.toHaveBeenCalled();
    expect(convexClientInstances[0]?.query).toHaveBeenCalledWith(query, {});
  });
});
