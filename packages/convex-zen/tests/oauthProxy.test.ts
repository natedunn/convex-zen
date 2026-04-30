import { describe, expect, it } from "vitest";

import { matchesOAuthProxyReturnTarget } from "../src/client/oauth-proxy.js";
import type { OAuthProxyReturnTargetRule } from "../src/types.js";

describe("oauth proxy matcher", () => {
  it("continues evaluating later rules when an earlier webUrl rule is malformed", () => {
    const rules = [
      { type: "webUrl", url: "not-a-valid-url" },
      { type: "nativeCallback", callbackUrl: "myapp://oauth" },
    ] as unknown as OAuthProxyReturnTargetRule[];

    expect(matchesOAuthProxyReturnTarget("myapp://oauth", rules)).toBe(true);
  });

  it("continues evaluating later rules when an earlier webUrlPattern rule is malformed", () => {
    const rules = [
      { type: "webUrlPattern", pattern: "https://**.example.com" },
      { type: "nativeCallback", callbackUrl: "myapp://oauth" },
    ] as unknown as OAuthProxyReturnTargetRule[];

    expect(matchesOAuthProxyReturnTarget("myapp://oauth", rules)).toBe(true);
  });
});
