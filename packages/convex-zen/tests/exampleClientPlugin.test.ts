import { describe, expect, it, vi } from "vitest";
import {
  ExamplePlugin,
  examplePlugin,
} from "../../convex-zen-example/src/index";

describe("example plugin", () => {
  it("uses the generated gateway metadata", () => {
    expect(examplePlugin.definition.id).toBe("example");
    expect(Object.keys(examplePlugin.definition.gateway)).toEqual([
      "log",
      "listLogs",
    ]);
  });

  it("adds a simple runtime helper on top of the generated gateway", async () => {
    const log = vi.fn(async () => ({ ok: true }));
    const listLogs = vi.fn(async () => ({ scope: "docs", entries: [] }));
    const plugin = new ExamplePlugin(
      {
        log,
        listLogs,
      },
      { defaultScope: "docs" }
    );

    await plugin.logInfo(
      { runMutation: vi.fn() },
      { message: "hello from docs", tag: "guide" }
    );

    expect(log).toHaveBeenCalledWith(
      { runMutation: expect.any(Function) },
      {
        message: "hello from docs",
        level: "info",
        scope: "docs",
        tag: "guide",
      }
    );

    await plugin.getDefaultScopeLogs({ runQuery: vi.fn() }, { limit: 5 });

    expect(listLogs).toHaveBeenCalledWith(
      { runQuery: expect.any(Function) },
      {
        scope: "docs",
        limit: 5,
      }
    );
  });
});
