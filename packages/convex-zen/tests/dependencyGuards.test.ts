import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

function collectTypeScriptFiles(directory: string): string[] {
  const entries = readdirSync(directory);
  const output: string[] = [];

  for (const entry of entries) {
    const fullPath = join(directory, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      output.push(...collectTypeScriptFiles(fullPath));
      continue;
    }
    if (fullPath.endsWith(".ts") || fullPath.endsWith(".tsx")) {
      output.push(fullPath);
    }
  }

  return output;
}

describe("dependency guards", () => {
  it("keeps @tanstack/react-query out of core client source", () => {
    const clientRoot = join(process.cwd(), "src", "client");
    const sourceFiles = collectTypeScriptFiles(clientRoot);

    for (const sourceFile of sourceFiles) {
      const source = readFileSync(sourceFile, "utf8");
      expect(source, sourceFile).not.toContain("@tanstack/react-query");
    }
  });
});
