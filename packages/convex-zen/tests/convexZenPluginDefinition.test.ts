import { describe, expect, expectTypeOf, it, vi } from "vitest";
import { v } from "convex/values";
import {
  createConvexZenClient,
  defineConvexZen,
  definePlugin,
} from "../src/client";
import { pluginMutation, pluginQuery } from "../src/component";

const customPlugin = definePlugin({
  id: "custom",
  gateway: {},
  extendRuntime: () => ({
    hello: "world" as const,
  }),
});

const typedGateway = {
  listLogs: pluginQuery({
    auth: "public",
    args: {
      scope: v.optional(v.string()),
      limit: v.optional(v.number()),
    },
    handler: async (_ctx, args) => [{ scope: args.scope ?? "default", limit: args.limit ?? 10 }],
  }),
  log: pluginMutation({
    auth: "actor",
    args: {
      message: v.string(),
    },
    handler: async (_ctx, args) => ({
      actorUserId: args.actorUserId,
      message: args.message,
    }),
  }),
};

const typedPlugin = definePlugin({
  id: "typed",
  gateway: typedGateway,
});

const hookDeleteStateHandler = vi.fn(
  async (_ctx: unknown, args: Record<string, unknown>) => args.userId
);

const hookPlugin = definePlugin({
  id: "hook",
  gateway: {
    deleteState: Object.assign(() => null, {
      _handler: hookDeleteStateHandler,
    }),
  },
  hooks: {
    onUserDeleted: async ({ userId, callPluginMutation }) => {
      await callPluginMutation("deleteState", { userId });
    },
  },
});

describe("defineConvexZen", () => {
  it("rejects duplicate plugin ids", () => {
    expect(() =>
      defineConvexZen({
        plugins: [customPlugin(), customPlugin()],
      })
    ).toThrow('Duplicate auth plugin id "custom"');
  });

  it("builds auth.plugins from configured plugin definitions", () => {
    const auth = createConvexZenClient(
      {},
      defineConvexZen({
        plugins: [customPlugin()] as const,
      })
    );

    expect(auth.plugins.custom.hello).toBe("world");
    expectTypeOf(auth.plugins.custom.hello).toEqualTypeOf<"world">();

    type HasOrganization = "organization" extends keyof typeof auth ? true : false;
    type HasPlugin = "plugin" extends keyof typeof auth ? true : false;

    expectTypeOf<HasOrganization>().toEqualTypeOf<false>();
    expectTypeOf<HasPlugin>().toEqualTypeOf<false>();
  });

  it("keeps plugin definitions minimal and gateway-first", () => {
    expect(customPlugin.definition.id).toBe("custom");
    expect(customPlugin.definition.gateway).toEqual({});
  });

  it("preserves gateway arg and return types in plugin runtime methods", async () => {
    const auth = createConvexZenClient(
      {},
      defineConvexZen({
        plugins: [typedPlugin()] as const,
      })
    );

    expectTypeOf<Parameters<typeof auth.plugins.typed.listLogs>[1]>().toEqualTypeOf<{
      scope?: string;
      limit?: number;
    }>();
    expectTypeOf<
      Awaited<ReturnType<typeof auth.plugins.typed.listLogs>>
    >().toEqualTypeOf<Array<{ scope: string; limit: number }>>();

    expectTypeOf<Parameters<typeof auth.plugins.typed.log>[1]>().toEqualTypeOf<{
      message: string;
    }>();
    expectTypeOf<
      Awaited<ReturnType<typeof auth.plugins.typed.log>>
    >().toEqualTypeOf<{
      actorUserId: string;
      message: string;
    }>();
  });

  it("routes core methods through core child refs in component runtime mode", async () => {
    const auth = createConvexZenClient(
      {},
      defineConvexZen({}),
      {
        runtimeKind: "component",
        coreRefs: {
          gateway: {
            invalidateSession: "gateway:invalidateSession",
          },
        },
      }
    );
    const runMutation = vi.fn(async () => undefined);

    await auth.signOut({ runMutation }, "session_token");

    expect(runMutation).toHaveBeenCalledWith(
      "gateway:invalidateSession",
      { token: "session_token" }
    );
  });

  it("routes component plugin methods through raw gateway handlers", async () => {
    const auth = createConvexZenClient(
      {},
      defineConvexZen({
        plugins: [typedPlugin()] as const,
        runtime: {
          resolveUserId: async () => "user_1",
        },
      }),
      {
        runtimeKind: "component",
      }
    );
    const runMutation = vi.fn(async () => ({
      actorUserId: "user_1",
      message: "hello",
    }));

    await expect(
      auth.plugins.typed.log({ runMutation }, { message: "hello" })
    ).resolves.toEqual({
      actorUserId: "user_1",
      message: "hello",
    });

    expect(runMutation).not.toHaveBeenCalled();
  });

  it("runs component plugin hook mutations through attached handlers", async () => {
    hookDeleteStateHandler.mockClear();

    const auth = createConvexZenClient(
      {},
      defineConvexZen({
        plugins: [hookPlugin()] as const,
      }),
      {
        runtimeKind: "component",
        coreRefs: {
          removeUser: "core/users:remove",
        },
      }
    );
    const runMutation = vi.fn(async () => undefined);

    await auth.deleteAuthUser({ runMutation }, "user_1");

    expect(hookDeleteStateHandler).toHaveBeenCalledWith(
      { runMutation },
      { userId: "user_1" }
    );
    expect(runMutation).toHaveBeenCalledTimes(1);
    expect(runMutation).toHaveBeenCalledWith("core/users:remove", {
      userId: "user_1",
    });
  });
});
