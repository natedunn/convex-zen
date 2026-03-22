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
      {
        core: {
          gateway: {
            invalidateSession: "core/gateway:invalidateSession",
          },
        },
      },
      defineConvexZen({}),
      { runtimeKind: "component" }
    );
    const runMutation = vi.fn(async () => undefined);

    await auth.signOut({ runMutation }, "session_token");

    expect(runMutation).toHaveBeenCalledWith(
      "core/gateway:invalidateSession",
      { token: "session_token" }
    );
  });
});
