import { describe, expect, it, vi } from "vitest";
import type { FunctionReference } from "convex/server";
import { coreApiPlugin } from "../src/client/tanstack-start/plugins";

function mutationRef(name: string): FunctionReference<"mutation", "public"> {
  return { name } as unknown as FunctionReference<"mutation", "public">;
}

function queryRef(name: string): FunctionReference<"query", "public"> {
  return { name } as unknown as FunctionReference<"query", "public">;
}

function actionRef(name: string): FunctionReference<"action", "public"> {
  return { name } as unknown as FunctionReference<"action", "public">;
}

describe("coreApiPlugin", () => {
  it("dispatches core mutation routes to fetchMutation", async () => {
    const signUpRef = mutationRef("signUp");
    const fetchMutation = vi.fn(async () => ({ ok: true }));
    const plugin = coreApiPlugin().create({
      tanstackAuth: {
        getSession: vi.fn(),
        getToken: vi.fn(),
        signIn: vi.fn(),
        signOut: vi.fn(),
        requireSession: vi.fn(),
        withSession: vi.fn(),
      },
      fetchers: {
        fetchQuery: vi.fn(),
        fetchMutation,
        fetchAction: vi.fn(),
        fetchAuthQuery: vi.fn(),
        fetchAuthMutation: vi.fn(),
        fetchAuthAction: vi.fn(),
      },
      convexFunctions: {
        core: {
          signUp: signUpRef,
        },
      },
    });

    const response = await plugin.handle({
      request: new Request("https://example.com/api/auth/core/sign-up", {
        method: "POST",
      }),
      method: "POST",
      action: "core/sign-up",
      readJson: async () => ({ email: "hello@example.com", password: "x" }),
      json: (data, status = 200) => new Response(JSON.stringify(data), { status }),
    });

    expect(fetchMutation).toHaveBeenCalledWith(signUpRef, {
      email: "hello@example.com",
      password: "x",
    });
    expect(response?.status).toBe(200);
  });

  it("falls back to query/action when kind mismatch errors occur", async () => {
    const getOAuthUrlRef = actionRef("getOAuthUrl");
    const fetchMutation = vi.fn(async () => {
      throw new Error("No mutation exists with name");
    });
    const fetchQuery = vi.fn(async () => {
      throw new Error("No query exists with name");
    });
    const fetchAction = vi.fn(async () => ({ url: "https://idp.example.com" }));
    const plugin = coreApiPlugin().create({
      tanstackAuth: {
        getSession: vi.fn(),
        getToken: vi.fn(),
        signIn: vi.fn(),
        signOut: vi.fn(),
        requireSession: vi.fn(),
        withSession: vi.fn(),
      },
      fetchers: {
        fetchQuery,
        fetchMutation,
        fetchAction,
        fetchAuthQuery: vi.fn(),
        fetchAuthMutation: vi.fn(),
        fetchAuthAction: vi.fn(),
      },
      convexFunctions: {
        core: {
          getOAuthUrl: getOAuthUrlRef,
        },
      },
    });

    const response = await plugin.handle({
      request: new Request("https://example.com/api/auth/core/get-oauth-url", {
        method: "POST",
      }),
      method: "POST",
      action: "core/get-oauth-url",
      readJson: async () => ({ providerId: "google" }),
      json: (data, status = 200) => new Response(JSON.stringify(data), { status }),
    });

    expect(fetchMutation).toHaveBeenCalledOnce();
    expect(fetchQuery).toHaveBeenCalledOnce();
    expect(fetchAction).toHaveBeenCalledWith(getOAuthUrlRef, {
      providerId: "google",
    });
    expect(response?.status).toBe(200);
  });

  it("returns null for unmatched core routes", async () => {
    const plugin = coreApiPlugin().create({
      tanstackAuth: {
        getSession: vi.fn(),
        getToken: vi.fn(),
        signIn: vi.fn(),
        signOut: vi.fn(),
        requireSession: vi.fn(),
        withSession: vi.fn(),
      },
      fetchers: {
        fetchQuery: vi.fn(),
        fetchMutation: vi.fn(),
        fetchAction: vi.fn(),
        fetchAuthQuery: vi.fn(),
        fetchAuthMutation: vi.fn(),
        fetchAuthAction: vi.fn(),
      },
      convexFunctions: {
        core: {
          currentUser: queryRef("currentUser"),
        },
      },
    });

    const response = await plugin.handle({
      request: new Request("https://example.com/api/auth/plugin/system-admin/list-users", {
        method: "POST",
      }),
      method: "POST",
      action: "plugin/system-admin/list-users",
      readJson: async () => ({}),
      json: (data, status = 200) => new Response(JSON.stringify(data), { status }),
    });

    expect(response).toBeNull();
  });

  it("uses authenticated query fetcher for current-user route", async () => {
    const currentUserRef = queryRef("currentUser");
    const fetchAuthQuery = vi.fn(async () => ({ id: "user_1" }));
    const fetchMutation = vi.fn(async () => {
      throw new Error("No mutation exists with name");
    });
    const fetchQuery = vi.fn(async () => ({ id: "fallback_user" }));
    const plugin = coreApiPlugin().create({
      tanstackAuth: {
        getSession: vi.fn(),
        getToken: vi.fn(),
        signIn: vi.fn(),
        signOut: vi.fn(),
        requireSession: vi.fn(),
        withSession: vi.fn(),
      },
      fetchers: {
        fetchQuery,
        fetchMutation,
        fetchAction: vi.fn(),
        fetchAuthQuery,
        fetchAuthMutation: vi.fn(),
        fetchAuthAction: vi.fn(),
      },
      convexFunctions: {
        core: {
          currentUser: currentUserRef,
        },
      },
    });

    const response = await plugin.handle({
      request: new Request("https://example.com/api/auth/core/current-user", {
        method: "POST",
      }),
      method: "POST",
      action: "core/current-user",
      readJson: async () => ({}),
      json: (data, status = 200) => new Response(JSON.stringify(data), { status }),
    });

    expect(fetchAuthQuery).toHaveBeenCalledWith(currentUserRef, {});
    expect(fetchQuery).not.toHaveBeenCalled();
    expect(response?.status).toBe(200);
  });

  it("returns null when authenticated current-user call is unauthorized", async () => {
    const currentUserRef = queryRef("currentUser");
    const fetchAuthQuery = vi.fn(async () => {
      throw new Error("Unauthorized");
    });
    const fetchMutation = vi.fn(async () => {
      throw new Error("No mutation exists with name");
    });
    const fetchQuery = vi.fn(async () => ({ id: "user_1" }));
    const fetchAction = vi.fn(async () => ({ id: "action_user" }));
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const plugin = coreApiPlugin().create({
      tanstackAuth: {
        getSession: vi.fn(),
        getToken: vi.fn(),
        signIn: vi.fn(),
        signOut: vi.fn(),
        requireSession: vi.fn(),
        withSession: vi.fn(),
      },
      fetchers: {
        fetchQuery,
        fetchMutation,
        fetchAction,
        fetchAuthQuery,
        fetchAuthMutation: vi.fn(),
        fetchAuthAction: vi.fn(),
      },
      convexFunctions: {
        core: {
          currentUser: currentUserRef,
        },
      },
    });

    try {
      const response = await plugin.handle({
        request: new Request("https://example.com/api/auth/core/current-user", {
          method: "POST",
        }),
        method: "POST",
        action: "core/current-user",
        readJson: async () => ({}),
        json: (data, status = 200) => new Response(JSON.stringify(data), { status }),
      });

      expect(fetchAuthQuery).toHaveBeenCalledOnce();
      expect(fetchQuery).not.toHaveBeenCalled();
      expect(fetchMutation).not.toHaveBeenCalled();
      expect(fetchAction).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledOnce();
      expect(response?.status).toBe(200);
      expect(await response?.json()).toBeNull();
    } finally {
      warnSpy.mockRestore();
    }
  });
});
