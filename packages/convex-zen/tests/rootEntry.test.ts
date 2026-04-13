import { describe, expect, it } from "vitest";
import * as convexZen from "../src/client/index";

describe("root entrypoint", () => {
  it("does not re-export Next.js runtime helpers", () => {
    expect(convexZen.definePlugin).toBeTypeOf("function");
    expect("createNextAuthClient" in convexZen).toBe(false);
    expect("createNextAuthServer" in convexZen).toBe(false);
    expect("createRequestFromHeaders" in convexZen).toBe(false);
  });
});
