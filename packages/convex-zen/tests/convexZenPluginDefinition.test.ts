import { describe, expect, expectTypeOf, it, vi } from "vitest";
import {
  createConvexZenClient,
  defineConvexZen,
  defineAuthPlugin,
} from "../src/client";

const customPlugin = defineAuthPlugin({
  id: "custom",
  component: { importPath: "@fixture/custom-plugin/convex.config" },
  createClientRuntime: () => ({
    hello: "world" as const,
  }),
  publicFunctions: {
    functions: {
      getHello: {
        kind: "query",
        auth: "public",
        runtimeMethod: "getHello",
        argsSource: "{}",
      },
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
