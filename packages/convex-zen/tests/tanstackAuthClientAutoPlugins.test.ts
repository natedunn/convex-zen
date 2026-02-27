import { describe, expect, it, vi } from "vitest";
import type { FunctionReference } from "convex/server";
import { createTanStackAuthClient } from "../src/client/tanstack-start-client";

const adminPluginMeta = {
  admin: {
    listUsers: "query",
    banUser: "mutation",
    setRole: "mutation",
    unbanUser: "mutation",
    deleteUser: "mutation",
  },
} as const;

function mutationRef(name: string): FunctionReference<"mutation", "public"> {
  return { name } as unknown as FunctionReference<"mutation", "public">;
}

function queryRef(name: string): FunctionReference<"query", "public"> {
  return { name } as unknown as FunctionReference<"query", "public">;
}

describe("createTanStackAuthClient auto plugins", () => {
  it('infers plugin methods by default ("auto") from convexFunctions + pluginMeta', () => {
    const authClient = createTanStackAuthClient({
      fetch: vi.fn(async () => new Response("{}")),
      convexFunctions: {
        plugin: {
          admin: {
            listUsers: queryRef("listUsers"),
            banUser: mutationRef("banUser"),
            setRole: mutationRef("setRole"),
            unbanUser: mutationRef("unbanUser"),
            deleteUser: mutationRef("deleteUser"),
          },
        },
      },
      pluginMeta: adminPluginMeta,
    });

    expect(typeof authClient.plugin.admin.listUsers).toBe("function");
    expect(typeof authClient.plugin.admin.banUser).toBe("function");
    expect(typeof authClient.plugin.admin.setRole).toBe("function");
    expect(typeof authClient.plugin.admin.unbanUser).toBe("function");
    expect(typeof authClient.plugin.admin.deleteUser).toBe("function");
  });

  it("calls the plugin API route when using inferred auto plugin methods", async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response(
        JSON.stringify({ users: [], cursor: null, isDone: true }),
        {
          status: 200,
          headers: { "content-type": "application/json; charset=utf-8" },
        }
      );
    });
    const authClient = createTanStackAuthClient({
      fetch: fetchImpl,
      convexFunctions: {
        plugin: {
          admin: {
            listUsers: queryRef("listUsers"),
          },
        },
      },
      pluginMeta: {
        admin: {
          listUsers: "query",
        },
      },
    });

    const result = await authClient.plugin.admin.listUsers({ limit: 5 });

    expect(result).toEqual({ users: [], cursor: null, isDone: true });
    const firstCall = fetchImpl.mock.calls[0];
    expect(firstCall).toBeDefined();
    expect(String(firstCall?.[0])).toContain("/api/auth/plugin/admin/list-users");
    expect(firstCall?.[1]?.method).toBe("POST");
  });

  it("supports disabling auto plugins with plugins: []", () => {
    const authClient = createTanStackAuthClient({
      plugins: [] as const,
      fetch: vi.fn(async () => new Response("{}")),
      convexFunctions: {
        plugin: {
          admin: {
            listUsers: queryRef("listUsers"),
          },
        },
      },
      pluginMeta: {
        admin: {
          listUsers: "query",
        },
      },
    });

    expect((authClient as { plugin?: unknown }).plugin).toBeUndefined();
  });

  it("throws when auto plugins are enabled without pluginMeta", () => {
    expect(() =>
      createTanStackAuthClient({
        fetch: vi.fn(async () => new Response("{}")),
        convexFunctions: {
          plugin: {
            admin: {
              listUsers: queryRef("listUsers"),
            },
          },
        },
      })
    ).toThrow('createTanStackAuthClient requires "pluginMeta"');
  });
});
