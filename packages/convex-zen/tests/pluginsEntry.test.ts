import { describe, expect, it } from "vitest";
import * as plugins from "../src/plugins/index";

describe("plugins entrypoint", () => {
  it("re-exports built-in plugin factories", () => {
    expect(plugins.systemAdminPlugin).toBeTypeOf("function");
    expect(plugins.organizationPlugin).toBeTypeOf("function");
  });
});
