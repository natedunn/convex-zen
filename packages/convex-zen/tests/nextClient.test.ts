import { describe, expect, it, vi } from "vitest";
import type { FunctionReference } from "convex/server";
import {
  createNextAuthClient,
  createNextReactAuthClient,
} from "../src/client/next";

function queryRef(name: string): FunctionReference<"query", "public"> {
  return { name } as unknown as FunctionReference<"query", "public">;
}

describe("createNextAuthClient", () => {
  it("uses /api/auth as default base path", async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response(JSON.stringify({ token: "token_1" }), {
        status: 200,
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    });

    const client = createNextAuthClient({ fetch: fetchImpl });
    await expect(client.getToken()).resolves.toBe("token_1");

    expect(String(fetchImpl.mock.calls[0]?.[0])).toContain("/api/auth/token");
  });

  it("supports custom basePath", async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response(
        JSON.stringify({ session: { userId: "u1", sessionId: "s1" } }),
        {
          status: 200,
          headers: { "content-type": "application/json; charset=utf-8" },
        }
      );
    });

    const client = createNextAuthClient({
      basePath: "/auth",
      fetch: fetchImpl,
    });
    await expect(client.getSession()).resolves.toEqual({
      userId: "u1",
      sessionId: "s1",
    });

    expect(String(fetchImpl.mock.calls[0]?.[0])).toContain("/auth/session");
  });

  it("adds plugin/core/query helpers when convexFunctions + meta are provided", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/plugin/admin/list-users")) {
        return new Response(
          JSON.stringify({ users: [], cursor: null, isDone: true }),
          {
            status: 200,
            headers: { "content-type": "application/json; charset=utf-8" },
          }
        );
      }
      if (url.includes("/core/current-user")) {
        return new Response(JSON.stringify({ id: "u1" }), {
          status: 200,
          headers: { "content-type": "application/json; charset=utf-8" },
        });
      }
      return new Response("{}", {
        status: 200,
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    });

    const authClient = createNextAuthClient({
      fetch: fetchImpl,
      convexFunctions: {
        core: {
          currentUser: queryRef("core.currentUser"),
        },
        plugin: {
          admin: {
            listUsers: queryRef("plugin.admin.listUsers"),
          },
        },
      },
      meta: {
        core: {
          currentUser: "query",
        },
        plugin: {
          admin: {
            listUsers: "query",
          },
        },
      },
    });

    await authClient.plugin.admin.listUsers({ limit: 5 });
    expect(String(fetchImpl.mock.calls[0]?.[0])).toContain(
      "/api/auth/plugin/admin/list-users"
    );

    const listUsersQuery = authClient.plugin.admin.listUsers.query({ limit: 2 });
    expect(listUsersQuery.queryKey[0]).toBe("convexAuthQuery");
    expect(typeof listUsersQuery.queryFn).toBe("function");
    await expect(listUsersQuery.queryFn?.({})).resolves.toEqual({
      users: [],
      cursor: null,
      isDone: true,
    });

    const currentUserQuery = authClient.currentUser.query({});
    expect(currentUserQuery.queryKey[0]).toBe("convexAuthQuery");
    await expect(currentUserQuery.queryFn?.({})).resolves.toEqual({ id: "u1" });
  });
});

describe("createNextReactAuthClient", () => {
  it("adapts server session function to ReactAuthClient", async () => {
    const serverFns = {
      getSession: vi.fn(async () => ({ userId: "u1", sessionId: "s1" })),
    };

    const client = createNextReactAuthClient(serverFns);
    await expect(client.getSession()).resolves.toEqual({
      userId: "u1",
      sessionId: "s1",
    });
    expect(serverFns.getSession).toHaveBeenCalledTimes(1);
  });
});
