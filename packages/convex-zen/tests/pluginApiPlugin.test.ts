import { describe, expect, it, vi } from "vitest";
import type { FunctionReference } from "convex/server";
import { pluginApiPlugin } from "../src/client/tanstack-start-plugins";

function queryRef(name: string): FunctionReference<"query", "public"> {
  return { name } as unknown as FunctionReference<"query", "public">;
}

function mutationRef(name: string): FunctionReference<"mutation", "public"> {
  return { name } as unknown as FunctionReference<"mutation", "public">;
}

function actionRef(name: string): FunctionReference<"action", "public"> {
  return { name } as unknown as FunctionReference<"action", "public">;
}

describe("pluginApiPlugin", () => {
  it("dispatches query plugin routes to fetchAuthQuery", async () => {
    const listUsersRef = queryRef("listUsers");
    const fetchAuthQuery = vi.fn(async () => ({ users: [], cursor: null, isDone: true }));
    const fetchAuthMutation = vi.fn();
    const fetchAuthAction = vi.fn();
    const plugin = pluginApiPlugin({
      pluginMeta: {
        admin: {
          listUsers: "query",
        },
      },
    }).create({
      tanstackAuth: {
        getSession: vi.fn(),
        getToken: vi.fn(),
        signIn: vi.fn(),
        signOut: vi.fn(),
        requireSession: vi.fn(),
        withSession: vi.fn(),
      },
      fetchers: {
        fetchAuthQuery,
        fetchAuthMutation,
        fetchAuthAction,
        fetchQuery: vi.fn(),
        fetchMutation: vi.fn(),
        fetchAction: vi.fn(),
      },
      convexFunctions: {
        plugin: {
          admin: {
            listUsers: listUsersRef,
          },
        },
      },
    });

    const response = await plugin.handle({
      request: new Request("https://example.com/api/auth/plugin/admin/list-users", {
        method: "POST",
      }),
      method: "POST",
      action: "plugin/admin/list-users",
      readJson: async () => ({ limit: 10 }),
      json: (data, status = 200) => new Response(JSON.stringify(data), { status }),
    });

    expect(fetchAuthQuery).toHaveBeenCalledWith(listUsersRef, { limit: 10 });
    expect(fetchAuthMutation).not.toHaveBeenCalled();
    expect(fetchAuthAction).not.toHaveBeenCalled();
    expect(response?.status).toBe(200);
  });

  it("dispatches mutation plugin routes to fetchAuthMutation", async () => {
    const banUserRef = mutationRef("banUser");
    const fetchAuthMutation = vi.fn(async () => ({ ok: true }));
    const plugin = pluginApiPlugin({
      pluginMeta: {
        admin: {
          banUser: "mutation",
        },
      },
    }).create({
      tanstackAuth: {
        getSession: vi.fn(),
        getToken: vi.fn(),
        signIn: vi.fn(),
        signOut: vi.fn(),
        requireSession: vi.fn(),
        withSession: vi.fn(),
      },
      fetchers: {
        fetchAuthQuery: vi.fn(),
        fetchAuthMutation,
        fetchAuthAction: vi.fn(),
        fetchQuery: vi.fn(),
        fetchMutation: vi.fn(),
        fetchAction: vi.fn(),
      },
      convexFunctions: {
        plugin: {
          admin: {
            banUser: banUserRef,
          },
        },
      },
    });

    await plugin.handle({
      request: new Request("https://example.com/api/auth/plugin/admin/ban-user", {
        method: "POST",
      }),
      method: "POST",
      action: "plugin/admin/ban-user",
      readJson: async () => ({ userId: "user_1" }),
      json: (data, status = 200) => new Response(JSON.stringify(data), { status }),
    });

    expect(fetchAuthMutation).toHaveBeenCalledWith(banUserRef, {
      userId: "user_1",
    });
  });

  it("dispatches action plugin routes to fetchAuthAction", async () => {
    const fooBarRef = actionRef("fooBar");
    const fetchAuthAction = vi.fn(async () => ({ ok: true }));
    const plugin = pluginApiPlugin({
      pluginMeta: {
        customPlugin: {
          fooBar: "action",
        },
      },
    }).create({
      tanstackAuth: {
        getSession: vi.fn(),
        getToken: vi.fn(),
        signIn: vi.fn(),
        signOut: vi.fn(),
        requireSession: vi.fn(),
        withSession: vi.fn(),
      },
      fetchers: {
        fetchAuthQuery: vi.fn(),
        fetchAuthMutation: vi.fn(),
        fetchAuthAction,
        fetchQuery: vi.fn(),
        fetchMutation: vi.fn(),
        fetchAction: vi.fn(),
      },
      convexFunctions: {
        plugin: {
          customPlugin: {
            fooBar: fooBarRef,
          },
        },
      },
    });

    await plugin.handle({
      request: new Request(
        "https://example.com/api/auth/plugin/custom-plugin/foo-bar",
        {
          method: "POST",
        }
      ),
      method: "POST",
      action: "plugin/custom-plugin/foo-bar",
      readJson: async () => ({ hello: "world" }),
      json: (data, status = 200) => new Response(JSON.stringify(data), { status }),
    });

    expect(fetchAuthAction).toHaveBeenCalledWith(fooBarRef, {
      hello: "world",
    });
  });

  it("throws a clear error for missing plugin refs", () => {
    expect(() =>
      pluginApiPlugin({
        pluginMeta: {
          customPlugin: {
            fooBar: "action",
          },
        },
      }).create({
        tanstackAuth: {
          getSession: vi.fn(),
          getToken: vi.fn(),
          signIn: vi.fn(),
          signOut: vi.fn(),
          requireSession: vi.fn(),
          withSession: vi.fn(),
        },
        fetchers: {
          fetchAuthQuery: vi.fn(),
          fetchAuthMutation: vi.fn(),
          fetchAuthAction: vi.fn(),
          fetchQuery: vi.fn(),
          fetchMutation: vi.fn(),
          fetchAction: vi.fn(),
        },
        convexFunctions: {
          plugin: {
            customPlugin: {},
          },
        },
      })
    ).toThrow("convexFunctions.plugin.customPlugin.fooBar");
  });
});
