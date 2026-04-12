import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");
const testVersion = "0.0.0-stage-test";

const stageDir = execFileSync(
  "node",
  [path.join(scriptDir, "stage-package.mjs"), "convex-zen", testVersion],
  {
    cwd: repoRoot,
    encoding: "utf8",
    env: process.env,
  }
)
  .trim()
  .split("\n")
  .at(-1);

if (!stageDir) {
  throw new Error("Expected stage-package to print the staged directory.");
}

try {
  const stagedPackageJson = JSON.parse(
    readFileSync(path.join(stageDir, "package.json"), "utf8")
  );

  assert.equal(stagedPackageJson.version, testVersion);
  assert.deepEqual(stagedPackageJson.files, [
    "dist",
    "src",
    "README.md",
    "LICENSE",
  ]);
  assert.ok(
    existsSync(path.join(stageDir, "dist")),
    "Expected staged package to include dist/"
  );
  assert.ok(
    existsSync(path.join(stageDir, "src")),
    "Expected staged package to include src/"
  );

  process.stdout.write("PASS stage-package-includes-configured-files\n");
} finally {
  rmSync(stageDir, { recursive: true, force: true });
}
