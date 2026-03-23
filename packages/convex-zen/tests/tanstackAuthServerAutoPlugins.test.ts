import { describe, expect, it } from "vitest";
import type { FunctionReference } from "convex/server";
import { createTanStackAuthServer } from "../src/client/tanstack-start";
import type { SessionTokenCodec } from "../src/client/identity-jwt";

const passthroughSessionTokenCodec: SessionTokenCodec = {
  encode: async ({ sessionToken }) => sessionToken,
  decode: async (token) => ({ userId: "user_1", sessionToken: token }),
};

const systemAdminPluginMeta = {
  systemAdmin: {
    listUsers: "query",
    banUser: "mutation",
    setRole: "mutation",
    unbanUser: "mutation",
    deleteUser: "mutation",
  },
} as const;

const authMeta = {
  core: {},
  plugin: systemAdminPluginMeta,
} as const;

const authMetaWithCore = {
  core: {
    signUp: "mutation",
  },
  plugin: systemAdminPluginMeta,
} as const;

function mutationRef(name: string): FunctionReference<"mutation", "public"> {
  return { name } as unknown as FunctionReference<"mutation", "public">;
}

function queryRef(name: string): FunctionReference<"query", "public"> {
  return { name } as unknown as FunctionReference<"query", "public">;
}

function createNonEnumerableConvexFunctionsProxy() {
  const coreRefs = {
    signInWithEmail: mutationRef("signInWithEmail"),
    validateSession: mutationRef("validateSession"),
    invalidateSession: mutationRef("invalidateSession"),
    signUp: mutationRef("signUp"),
  };
  const systemAdminRefs = {
    listUsers: queryRef("listUsers"),
    banUser: mutationRef("banUser"),
    setRole: mutationRef("setRole"),
    unbanUser: mutationRef("unbanUser"),
    deleteUser: mutationRef("deleteUser"),
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
  const systemAdmin = new Proxy(
    {},
    {
      get: (_target, prop) =>
        typeof prop === "string"
          ? (systemAdminRefs as Record<string, unknown>)[prop]
          : undefined,
      ownKeys: () => [],
      getOwnPropertyDescriptor: () => undefined,
    }
  );
  const plugin = new Proxy(
    {},
    {
      get: (_target, prop) => (prop === "systemAdmin" ? systemAdmin : undefined),
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

describe("createTanStackAuthServer auto plugins", () => {
  it("enables plugin routes by default when pluginMeta is provided", async () => {
    const authServer = createTanStackAuthServer({
      convexUrl: "https://example.convex.cloud",
      convexFunctions: {
        core: {
          signInWithEmail: mutationRef("signInWithEmail"),
          validateSession: mutationRef("validateSession"),
          invalidateSession: mutationRef("invalidateSession"),
        },
        plugin: {
          systemAdmin: {
            listUsers: queryRef("listUsers"),
            banUser: mutationRef("banUser"),
            setRole: mutationRef("setRole"),
            unbanUser: mutationRef("unbanUser"),
            deleteUser: mutationRef("deleteUser"),
          },
        },
      },
      pluginMeta: systemAdminPluginMeta,
      sessionTokenCodec: passthroughSessionTokenCodec,
    });

    const response = await authServer.handler(
      new Request("https://app.test/api/auth/plugin/system-admin/list-users", {
        method: "GET",
      })
    );

    // 405 confirms the plugin route handler is active.
    expect(response.status).toBe(405);
  });

  it("enables plugin routes by default when meta is provided", async () => {
    const authServer = createTanStackAuthServer({
      convexUrl: "https://example.convex.cloud",
      convexFunctions: {
        core: {
          signInWithEmail: mutationRef("signInWithEmail"),
          validateSession: mutationRef("validateSession"),
          invalidateSession: mutationRef("invalidateSession"),
        },
        plugin: {
          systemAdmin: {
            listUsers: queryRef("listUsers"),
            banUser: mutationRef("banUser"),
            setRole: mutationRef("setRole"),
            unbanUser: mutationRef("unbanUser"),
            deleteUser: mutationRef("deleteUser"),
          },
        },
      },
      meta: authMeta,
      sessionTokenCodec: passthroughSessionTokenCodec,
    });

    const response = await authServer.handler(
      new Request("https://app.test/api/auth/plugin/system-admin/list-users", {
        method: "GET",
      })
    );

    expect(response.status).toBe(405);
  });

  it("enables organization plugin routes through generic plugin metadata", async () => {
    const authServer = createTanStackAuthServer({
      convexUrl: "https://example.convex.cloud",
      convexFunctions: {
        core: {
          signInWithEmail: mutationRef("signInWithEmail"),
          validateSession: mutationRef("validateSession"),
          invalidateSession: mutationRef("invalidateSession"),
        },
        plugin: {
          organization: {
            listOrganizations: queryRef("listOrganizations"),
          },
        },
      },
      pluginMeta: {
        organization: {
          listOrganizations: "query",
        },
      },
      sessionTokenCodec: passthroughSessionTokenCodec,
    });

    const response = await authServer.handler(
      new Request("https://app.test/api/auth/plugin/organization/list-organizations", {
        method: "GET",
      })
    );

    expect(response.status).toBe(405);
  });

  it("throws when auto plugins are enabled without pluginMeta", () => {
    expect(() =>
      createTanStackAuthServer({
        convexUrl: "https://example.convex.cloud",
        convexFunctions: {
          core: {
            signInWithEmail: mutationRef("signInWithEmail"),
            validateSession: mutationRef("validateSession"),
            invalidateSession: mutationRef("invalidateSession"),
          },
          plugin: {
            systemAdmin: {
              listUsers: queryRef("listUsers"),
              banUser: mutationRef("banUser"),
              setRole: mutationRef("setRole"),
              unbanUser: mutationRef("unbanUser"),
              deleteUser: mutationRef("deleteUser"),
            },
          },
        },
        sessionTokenCodec: passthroughSessionTokenCodec,
      })
    ).toThrow('createTanStackAuthServer requires "pluginMeta"');
  });

  it("uses explicit plugin list when provided", async () => {
    const authServer = createTanStackAuthServer({
      convexUrl: "https://example.convex.cloud",
      convexFunctions: {
        core: {
          signInWithEmail: mutationRef("signInWithEmail"),
          validateSession: mutationRef("validateSession"),
          invalidateSession: mutationRef("invalidateSession"),
        },
        plugin: {
          systemAdmin: {
            listUsers: queryRef("listUsers"),
            banUser: mutationRef("banUser"),
            setRole: mutationRef("setRole"),
            unbanUser: mutationRef("unbanUser"),
            deleteUser: mutationRef("deleteUser"),
          },
        },
      },
      pluginMeta: systemAdminPluginMeta,
      plugins: [],
      sessionTokenCodec: passthroughSessionTokenCodec,
    });

    const response = await authServer.handler(
      new Request("https://app.test/api/auth/plugin/system-admin/list-users", {
        method: "GET",
      })
    );

    expect(response.status).toBe(404);
  });

  it("throws a clear error when pluginMeta references missing convexFunctions refs", () => {
    expect(() =>
      createTanStackAuthServer({
        convexUrl: "https://example.convex.cloud",
        convexFunctions: {
          core: {
            signInWithEmail: mutationRef("signInWithEmail"),
            validateSession: mutationRef("validateSession"),
            invalidateSession: mutationRef("invalidateSession"),
          },
          plugin: {
            systemAdmin: {
              listUsers: queryRef("listUsers"),
            },
          },
        },
        pluginMeta: systemAdminPluginMeta,
        sessionTokenCodec: passthroughSessionTokenCodec,
      })
    ).toThrow("convexFunctions.plugin.systemAdmin.banUser");
  });

  it("auto-detects plugin routes for proxy-based convexFunctions refs", async () => {
    const authServer = createTanStackAuthServer({
      convexUrl: "https://example.convex.cloud",
      convexFunctions:
        createNonEnumerableConvexFunctionsProxy() as unknown as {
          core: {
            signInWithEmail: FunctionReference<"mutation", "public">;
            validateSession: FunctionReference<"mutation", "public">;
            invalidateSession: FunctionReference<"mutation", "public">;
          };
          plugin: {
            systemAdmin: {
              listUsers: FunctionReference<"query", "public">;
              banUser: FunctionReference<"mutation", "public">;
              setRole: FunctionReference<"mutation", "public">;
              unbanUser: FunctionReference<"mutation", "public">;
              deleteUser: FunctionReference<"mutation", "public">;
            };
          };
        },
      pluginMeta: systemAdminPluginMeta,
      sessionTokenCodec: passthroughSessionTokenCodec,
    });

    const response = await authServer.handler(
      new Request("https://app.test/api/auth/plugin/system-admin/list-users", {
        method: "GET",
      })
    );

    expect(response.status).toBe(405);
  });

  it("auto-detects core routes for proxy-based convexFunctions refs when core meta is provided", async () => {
    const authServer = createTanStackAuthServer({
      convexUrl: "https://example.convex.cloud",
      convexFunctions:
        createNonEnumerableConvexFunctionsProxy() as unknown as {
          core: {
            signInWithEmail: FunctionReference<"mutation", "public">;
            validateSession: FunctionReference<"mutation", "public">;
            invalidateSession: FunctionReference<"mutation", "public">;
            signUp: FunctionReference<"mutation", "public">;
          };
          plugin: {
            systemAdmin: {
              listUsers: FunctionReference<"query", "public">;
              banUser: FunctionReference<"mutation", "public">;
              setRole: FunctionReference<"mutation", "public">;
              unbanUser: FunctionReference<"mutation", "public">;
              deleteUser: FunctionReference<"mutation", "public">;
            };
          };
        },
      meta: authMetaWithCore,
      sessionTokenCodec: passthroughSessionTokenCodec,
    });

    const response = await authServer.handler(
      new Request("https://app.test/api/auth/core/sign-up", {
        method: "GET",
      })
    );

    // 405 confirms the core route handler is active.
    expect(response.status).toBe(405);
  });

  it("enables core routes without pluginMeta", async () => {
    const authServer = createTanStackAuthServer({
      convexUrl: "https://example.convex.cloud",
      convexFunctions: {
        core: {
          signInWithEmail: mutationRef("signInWithEmail"),
          validateSession: mutationRef("validateSession"),
          invalidateSession: mutationRef("invalidateSession"),
          signUp: mutationRef("signUp"),
        },
      },
      sessionTokenCodec: passthroughSessionTokenCodec,
    });

    const response = await authServer.handler(
      new Request("https://app.test/api/auth/core/sign-up", {
        method: "GET",
      })
    );

    // 405 confirms the core route handler is active.
    expect(response.status).toBe(405);
  });
});
