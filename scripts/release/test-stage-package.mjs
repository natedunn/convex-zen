import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { builtInPlugins } from "./built-in-plugins.mjs";

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
    "plugins",
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
  assert.ok(
    existsSync(path.join(stageDir, "plugins")),
    "Expected staged package to include plugins/"
  );
}

function assertBuiltInPluginMetadata(stageDir, stagedPackageJson) {
  const expectedTypesVersions = Object.fromEntries(
    builtInPlugins.map((pluginId) => [
      `plugins/${pluginId}`,
      [`plugins/${pluginId}/index.d.ts`],
    ])
  );

  assert.deepEqual(stagedPackageJson.typesVersions, {
    "*": expectedTypesVersions,
  });

  for (const pluginId of builtInPlugins) {
    assert.deepEqual(stagedPackageJson.exports[`./plugins/${pluginId}`], {
      types: `./plugins/${pluginId}/index.d.ts`,
      import: `./plugins/${pluginId}/index.js`,
    });
    assert.ok(
      existsSync(path.join(stageDir, "plugins", pluginId, "index.js")),
      `Expected staged package to include ${pluginId} subpath shim`
    );
    assert.ok(
      existsSync(path.join(stageDir, "plugins", pluginId, "index.d.ts")),
      `Expected staged package to include ${pluginId} type shim`
    );
  }
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
  assertBuiltInPluginMetadata(convexZen.stageDir, convexZen.stagedPackageJson);
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
