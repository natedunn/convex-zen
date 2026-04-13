import { describe, expect, it } from "vitest";
import * as convexZen from "../src/client/index";

const removedNextRuntimeExports = [
  "createNextAuthClient",
  "createNextReactAuthClient",
  "createNextServerAuth",
  "createNextServerAuthWithHandler",
  "createNextAuthApiHandler",
  "coreApiPlugin",
  "pluginApiPlugin",
  "createNextAuthServer",
  "createNextAuthServerFactory",
  "createNextConvexAuth",
  "createNextConvexFetchers",
  "createRequestFromHeaders",
  "resolveNextTrustedOriginsFromEnv",
] as const;

describe("root entrypoint", () => {
  it("does not re-export Next.js runtime helpers", () => {
    expect(convexZen.definePlugin).toBeTypeOf("function");

    for (const exportName of removedNextRuntimeExports) {
      expect(exportName in convexZen).toBe(false);
    }
  });
});
