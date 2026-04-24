import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");
const testVersion = "0.0.0-stage-test";

function stagePackage(packageName) {
  const stageDir = execFileSync(
    "node",
    [path.join(scriptDir, "stage-package.mjs"), packageName, testVersion],
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
    throw new Error(`Expected stage-package to print the staged directory for ${packageName}.`);
  }

  const stagedPackageJson = JSON.parse(
    readFileSync(path.join(stageDir, "package.json"), "utf8")
  );

  return {
    stageDir,
    stagedPackageJson,
  };
}

function assertCommonStageContents(stageDir, stagedPackageJson) {
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
}

const stagedPackages = [stagePackage("convex-zen")];

try {
  const convexZen = stagedPackages[0];

  assertCommonStageContents(convexZen.stageDir, convexZen.stagedPackageJson);
  assert.deepEqual(convexZen.stagedPackageJson.exports["./_generated/*.js"], {
    types: "./dist/component/_generated/*.d.ts",
    import: "./dist/component/_generated/*.js",
  });
  assert.deepEqual(convexZen.stagedPackageJson.exports["./core/_generated/*.js"], {
    types: "./dist/component/core/_generated/*.d.ts",
    import: "./dist/component/core/_generated/*.js",
  });
  assert.deepEqual(convexZen.stagedPackageJson.exports["./plugins"], {
    types: "./dist/plugins/index.d.ts",
    import: "./dist/plugins/index.js",
  });
  assert.deepEqual(convexZen.stagedPackageJson.exports["./plugins/system-admin"], {
    types: "./dist/plugins/system-admin/index.d.ts",
    import: "./dist/plugins/system-admin/index.js",
  });
  assert.deepEqual(convexZen.stagedPackageJson.exports["./plugins/organization"], {
    types: "./dist/plugins/organization/index.d.ts",
    import: "./dist/plugins/organization/index.js",
  });
  assert.deepEqual(
    convexZen.stagedPackageJson.exports["./component/core-schema-definition"],
    {
      types: "./dist/component/core/schemaDefinition.d.ts",
      import: "./dist/component/core/schemaDefinition.js",
    }
  );

  process.stdout.write("PASS stage-package-includes-configured-files\n");
  process.stdout.write("PASS stage-package-exports-generated-subpaths\n");
} finally {
  for (const { stageDir } of stagedPackages) {
    rmSync(stageDir, { recursive: true, force: true });
  }
}
