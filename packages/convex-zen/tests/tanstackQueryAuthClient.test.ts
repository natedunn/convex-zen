import { describe, expect, expectTypeOf, it, vi } from "vitest";
import type { FunctionReference } from "convex/server";
import { createTanStackQueryAuthClient } from "../src/client/tanstack-start-client";

function mutationRef(name: string): FunctionReference<"mutation", "public"> {
  return { name } as unknown as FunctionReference<"mutation", "public">;
}

function queryRef(name: string): FunctionReference<"query", "public"> {
  return { name } as unknown as FunctionReference<"query", "public">;
}

function actionRef(name: string): FunctionReference<"action", "public"> {
  return { name } as unknown as FunctionReference<"action", "public">;
}

function typedListUsersQueryRef(
  name: string
): FunctionReference<
  "query",
  "public",
  { limit?: number; cursor?: string },
  {
    users: { email: string }[];
    cursor: string | null;
    isDone: boolean;
  }
> {
  return {
    name,
  } as unknown as FunctionReference<
    "query",
    "public",
    { limit?: number; cursor?: string },
    {
      users: { email: string }[];
      cursor: string | null;
      isDone: boolean;
    }
  >;
}

function createNonEnumerableConvexFunctionsProxy() {
  const coreRefs = {
    currentUser: queryRef("core.currentUser"),
  };
  const adminRefs = {
    listUsers: queryRef("plugin.admin.listUsers"),
  };
  const core = new Proxy(
    {},
    {
      get: (_target, prop) =>
        typeof prop === "string"
          ? (coreRefs as Record<string, unknown>)[prop]
          : undefined,
      ownKeys: () => [],
      getOwnPropertyDescriptor: () => undefined,
    }
  );
  const admin = new Proxy(
    {},
    {
      get: (_target, prop) =>
        typeof prop === "string"
          ? (adminRefs as Record<string, unknown>)[prop]
          : undefined,
      ownKeys: () => [],
      getOwnPropertyDescriptor: () => undefined,
    }
  );
  const plugin = new Proxy(
    {},
    {
      get: (_target, prop) => (prop === "admin" ? admin : undefined),
      ownKeys: () => [],
      getOwnPropertyDescriptor: () => undefined,
    }
  );
  return new Proxy(
    {},
    {
      get: (_target, prop) => {
        if (prop === "core") {
          return core;
        }
        if (prop === "plugin") {
          return plugin;
        }
        return undefined;
      },
      ownKeys: () => [],
      getOwnPropertyDescriptor: () => undefined,
    }
  );
}

describe("createTanStackQueryAuthClient", () => {
  it("preserves route calls and adds TanStack query helpers for query functions", async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response(
        JSON.stringify({ users: [], cursor: null, isDone: true }),
        {
          status: 200,
          headers: { "content-type": "application/json; charset=utf-8" },
        }
      );
    });

    const listUsersRef = queryRef("plugin.admin.listUsers");
    const authClient = createTanStackQueryAuthClient({
      fetch: fetchImpl,
      convexFunctions: {
        plugin: {
          admin: {
            listUsers: listUsersRef,
          },
        },
      },
      pluginMeta: {
        admin: {
          listUsers: "query",
        },
      },
    });

    await authClient.plugin.admin.listUsers({ limit: 5 });
    expect(String(fetchImpl.mock.calls[0]?.[0])).toContain(
      "/api/auth/plugin/admin/list-users"
    );

    const queryOptions = authClient.plugin.admin.listUsers.query({ limit: 7 });
    const queryOptionsAlias = authClient.plugin.admin.listUsers.queryOptions({
      limit: 7,
    });
    expect(queryOptions.queryKey[0]).toBe("convexAuthQuery");
    expect(typeof queryOptions.queryKey[1]).toBe("string");
    expect(queryOptions.queryKey[2]).toEqual({ limit: 7 });
    expect(queryOptions.staleTime).toBe(Infinity);
    expect(queryOptionsAlias.queryKey).toEqual(queryOptions.queryKey);
    expect(queryOptionsAlias.staleTime).toBe(queryOptions.staleTime);
    expect(typeof queryOptions.queryFn).toBe("function");
    const queryData = await queryOptions.queryFn?.({});
    expect(queryData).toEqual({ users: [], cursor: null, isDone: true });
    expect(String(fetchImpl.mock.calls[1]?.[0])).toContain(
      "/api/auth/plugin/admin/list-users"
    );

    const queryClient = {
      prefetchQuery: vi.fn(async () => undefined),
      ensureQueryData: vi.fn(async () => ({ users: ["ok"] })),
    };

    await authClient.plugin.admin.listUsers.prefetchQuery(queryClient, {
      limit: 10,
    });
    expect(queryClient.prefetchQuery).toHaveBeenCalledOnce();

    const ensured = await authClient.plugin.admin.listUsers.ensureQueryData(
      queryClient,
      { limit: 2 }
    );
    expect(ensured).toEqual({ users: ["ok"] });
  });

  it("adds mutation and action helpers", async () => {
    const banUserRef = mutationRef("plugin.admin.banUser");
    const exportAuditRef = actionRef("plugin.admin.exportAudit");
    const authClient = createTanStackQueryAuthClient({
      fetch: vi.fn(async () => new Response("{}")),
      convexFunctions: {
        plugin: {
          admin: {
            banUser: banUserRef,
            exportAudit: exportAuditRef,
          },
        },
      },
      pluginMeta: {
        admin: {
          banUser: "mutation",
          exportAudit: "action",
        },
      },
    });

    const mutationExecutor = {
      mutation: vi.fn(async () => ({ ok: true })),
    };
    const runBanUser = authClient.plugin.admin.banUser.mutationFn(
      mutationExecutor
    );
    await runBanUser({ userId: "u_1" });
    await authClient.plugin.admin.banUser.mutate(mutationExecutor, {
      userId: "u_2",
    });
    expect(mutationExecutor.mutation).toHaveBeenNthCalledWith(1, banUserRef, {
      userId: "u_1",
    });
    expect(mutationExecutor.mutation).toHaveBeenNthCalledWith(2, banUserRef, {
      userId: "u_2",
    });

    const actionExecutor = {
      action: vi.fn(async () => ({ csv: "ok" })),
    };
    const actionOptions = authClient.plugin.admin.exportAudit.query({});
    const actionOptionsAlias = authClient.plugin.admin.exportAudit.queryOptions({});
    expect(actionOptions.queryKey[0]).toBe("convexAction");
    expect(typeof actionOptions.queryKey[1]).toBe("string");
    expect(actionOptions.queryKey[2]).toEqual({});
    expect(actionOptionsAlias).toEqual(actionOptions);

    const runExportAudit = authClient.plugin.admin.exportAudit.actionFn(
      actionExecutor
    );
    await runExportAudit({});
    await authClient.plugin.admin.exportAudit.runAction(actionExecutor, {});
    expect(actionExecutor.action).toHaveBeenNthCalledWith(1, exportAuditRef, {});
    expect(actionExecutor.action).toHaveBeenNthCalledWith(2, exportAuditRef, {});
  });

  it("adds helpers on generated core functions", async () => {
    const signUpRef = mutationRef("core.signUp");
    const getOAuthUrlRef = actionRef("core.getOAuthUrl");
    const currentUserRef = queryRef("core.currentUser");
    const fetchImpl = vi.fn(async () => {
      return new Response(JSON.stringify({ id: "user_1" }), {
        status: 200,
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    });
    const authClient = createTanStackQueryAuthClient({
      fetch: fetchImpl,
      convexFunctions: {
        core: {
          signUp: signUpRef,
          getOAuthUrl: getOAuthUrlRef,
          currentUser: currentUserRef,
        },
        plugin: {
          admin: {
            listUsers: queryRef("plugin.admin.listUsers"),
          },
        },
      },
      pluginMeta: {
        admin: {
          listUsers: "query",
        },
      },
    });

    const mutationExecutor = {
      mutation: vi.fn(async () => ({ ok: true })),
    };
    await authClient.core.signUp.mutate(mutationExecutor, {
      email: "hello@example.com",
      password: "password123",
    });
    await authClient.signUp.mutate(mutationExecutor, {
      email: "hello@example.com",
      password: "password123",
    });
    expect(mutationExecutor.mutation).toHaveBeenCalledWith(signUpRef, {
      email: "hello@example.com",
      password: "password123",
    });

    const actionOptions = authClient.core.getOAuthUrl.query({
      providerId: "google",
    });
    const rootActionOptions = authClient.getOAuthUrl.query({
      providerId: "google",
    });
    expect(actionOptions.queryKey[0]).toBe("convexAction");
    expect(rootActionOptions.queryKey[0]).toBe("convexAction");
    const actionExecutor = {
      action: vi.fn(async () => ({ url: "https://idp.example.com" })),
    };
    await authClient.core.getOAuthUrl.runAction(actionExecutor, {
      providerId: "google",
    });
    await authClient.getOAuthUrl.runAction(actionExecutor, {
      providerId: "google",
    });
    expect(actionExecutor.action).toHaveBeenCalledWith(getOAuthUrlRef, {
      providerId: "google",
    });

    const currentUserOptions = authClient.core.currentUser.query({});
    const rootCurrentUserOptions = authClient.currentUser.query({});
    expect(currentUserOptions.queryKey[0]).toBe("convexAuthQuery");
    expect(rootCurrentUserOptions.queryKey[0]).toBe("convexAuthQuery");
    expect(currentUserOptions.queryKey[1]).toBe("core.currentUser");
    expect(typeof currentUserOptions.queryFn).toBe("function");
    expect(typeof authClient.plugin.admin.listUsers.query({}).queryFn).toBe(
      "function"
    );
    const currentUser = await currentUserOptions.queryFn?.({});
    expect(currentUser).toEqual({ id: "user_1" });
    expect(String(fetchImpl.mock.calls[0]?.[0])).toContain(
      "/api/auth/core/current-user"
    );
  });

  it("supports custom core helper metadata via coreMeta", () => {
    const customLookupRef = queryRef("core.customLookup");
    const authClient = createTanStackQueryAuthClient({
      fetch: vi.fn(async () => new Response("{}")),
      convexFunctions: {
        core: {
          customLookup: customLookupRef,
        },
        plugin: {
          admin: {
            listUsers: queryRef("plugin.admin.listUsers"),
          },
        },
      },
      pluginMeta: {
        admin: {
          listUsers: "query",
        },
      },
      coreMeta: {
        customLookup: "query",
      },
    });

    const options = authClient.customLookup.query({ value: "x" } as never);
    expect(options.queryKey[0]).toBe("convexAuthQuery");
    expect(typeof options.queryFn).toBe("function");
  });

  it("throws when plugin routes are disabled", () => {
    expect(() =>
      createTanStackQueryAuthClient({
        plugins: [] as const,
        fetch: vi.fn(async () => new Response("{}")),
        convexFunctions: {
          plugin: {
            admin: {
              listUsers: queryRef("plugin.admin.listUsers"),
            },
          },
        },
        pluginMeta: {
          admin: {
            listUsers: "query",
          },
        },
      })
    ).toThrow("requires plugin route methods");
  });

  it("keeps query option result typing for framework adapters", () => {
    const listUsersRef = typedListUsersQueryRef("plugin.admin.listUsers");
    const authClient = createTanStackQueryAuthClient({
      fetch: vi.fn(async () => new Response("{}")),
      convexFunctions: {
        plugin: {
          admin: {
            listUsers: listUsersRef,
          },
        },
      },
      pluginMeta: {
        admin: {
          listUsers: "query",
        },
      },
    });

    const options = authClient.plugin.admin.listUsers.query({ limit: 10 });
    const inferData = <TData>(
      input: {
        queryFn?: (context: unknown) => TData | Promise<TData>;
      }
    ) => {
      return undefined as TData | undefined;
    };
    const inferred = inferData(options);

    expectTypeOf(inferred).toEqualTypeOf<
      | {
          users: { email: string }[];
          cursor: string | null;
          isDone: boolean;
        }
      | undefined
    >();
  });

  it("supports core query helpers with proxy-based convexFunctions when meta is provided", () => {
    const authClient = createTanStackQueryAuthClient({
      fetch: vi.fn(async () => new Response("{}")),
      convexFunctions:
        createNonEnumerableConvexFunctionsProxy() as unknown as {
          core: {
            currentUser: FunctionReference<"query", "public">;
          };
          plugin: {
            admin: {
              listUsers: FunctionReference<"query", "public">;
            };
          };
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

    const options = authClient.currentUser.query({});
    expect(options.queryKey[0]).toBe("convexAuthQuery");
    expect(options.queryKey[1]).toBe("core.currentUser");
  });
});
