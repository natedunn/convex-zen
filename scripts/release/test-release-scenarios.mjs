import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { getPackages } = require("./packages.cjs");
const {
  getPackageReleaseDecision,
  incrementVersion,
} = require("./lib/package-release-decision.cjs");

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");
const tempRoot = mkdtempSync(path.join(os.tmpdir(), "convex-zen-release-harness-"));

function run(command, args, cwd) {
  return execFileSync(command, args, {
    cwd,
    encoding: "utf8",
    env: process.env,
  }).trim();
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function writeRepoFile(repoDir, relativePath, content) {
  const filePath = path.join(repoDir, relativePath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
}

function commitAll(repoDir, subject, body) {
  run("git", ["add", "-A"], repoDir);
  const args = ["commit", "-m", subject];
  if (body) {
    args.push("-m", body);
  }
  run("git", args, repoDir);
}

function seedPackageRepo(templateDir) {
  run("git", ["init", "--initial-branch=main"], templateDir);
  run("git", ["config", "user.name", "Release Harness"], templateDir);
  run("git", ["config", "user.email", "release-harness@example.com"], templateDir);

  writeRepoFile(templateDir, "LICENSE", "Apache-2.0\n");
  writeRepoFile(templateDir, "README.md", "# Release harness\n");
  writeRepoFile(templateDir, "package.json", '{\n  "name": "release-harness"\n}\n');
  writeRepoFile(templateDir, "pnpm-lock.yaml", "lockfileVersion: '9.0'\n");
  writeRepoFile(templateDir, "scripts/release/README.md", "release docs\n");

  for (const packageConfig of getPackages()) {
    const sourcePackageJson = readJson(path.join(repoRoot, packageConfig.packageJsonPath));
    const packageJson = {
      name: sourcePackageJson.name,
      version: sourcePackageJson.version,
      ...(sourcePackageJson.dependencies
        ? { dependencies: sourcePackageJson.dependencies }
        : {}),
    };

    writeRepoFile(
      templateDir,
      packageConfig.packageJsonPath,
      `${JSON.stringify(packageJson, null, 2)}\n`
    );
    writeRepoFile(
      templateDir,
      path.posix.join(packageConfig.pkgRoot, "src/index.ts"),
      "export const core = true;\n"
    );
    writeRepoFile(
      templateDir,
      path.posix.join(packageConfig.pkgRoot, "README.md"),
      `# ${packageConfig.packageName}\n`
    );
  }

  commitAll(templateDir, "chore(repo): seed release harness");

  for (const packageConfig of getPackages()) {
    const packageJson = readJson(path.join(templateDir, packageConfig.packageJsonPath));
    const tag = packageConfig.tagFormat.replace("${version}", packageJson.version);
    run("git", ["tag", tag], templateDir);
  }
}

function cloneScenarioRepo(templateDir, scenarioName) {
  const scenarioDir = path.join(tempRoot, scenarioName);
  run("git", ["clone", "--quiet", "--no-hardlinks", templateDir, scenarioDir], tempRoot);
  run("git", ["config", "user.name", "Release Harness"], scenarioDir);
  run("git", ["config", "user.email", "release-harness@example.com"], scenarioDir);
  return scenarioDir;
}

function packageVersionsFromRepo(repoDir) {
  return Object.fromEntries(
    getPackages().map((packageConfig) => {
      const packageJson = readJson(path.join(repoDir, packageConfig.packageJsonPath));
      return [packageConfig.packageName, packageJson.version];
    })
  );
}

async function assertScenario({
  templateDir,
  name,
  arrange,
  expectedReleaseTypes,
}) {
  const scenarioDir = cloneScenarioRepo(templateDir, name);
  const baselineVersions = packageVersionsFromRepo(scenarioDir);

  await arrange(scenarioDir);

  for (const packageConfig of getPackages()) {
    const expectedReleaseType =
      expectedReleaseTypes[packageConfig.packageName] ?? null;
    const decision = await getPackageReleaseDecision({
      cwd: scenarioDir,
      packageName: packageConfig.packageName,
    });

    assert.equal(
      decision.releaseType,
      expectedReleaseType,
      `${name}: expected ${packageConfig.packageName} releaseType ${expectedReleaseType}, got ${decision.releaseType}`
    );

    const expectedNextVersion =
      expectedReleaseType == null
        ? null
        : incrementVersion(
            baselineVersions[packageConfig.packageName],
            expectedReleaseType
          );

    assert.equal(
      decision.nextVersion,
      expectedNextVersion,
      `${name}: expected ${packageConfig.packageName} nextVersion ${expectedNextVersion}, got ${decision.nextVersion}`
    );
  }

  process.stdout.write(`PASS ${name}\n`);
}

try {
  const templateDir = path.join(tempRoot, "template");
  mkdirSync(templateDir, { recursive: true });
  seedPackageRepo(templateDir);

  await assertScenario({
    templateDir,
    name: "core-only-patch",
    async arrange(repoDir) {
      writeRepoFile(
        repoDir,
        "packages/convex-zen/src/index.ts",
        "export const core = 'patched';\n"
      );
      commitAll(repoDir, "fix(core): patch the core package");
    },
    expectedReleaseTypes: {
      "convex-zen": "patch",
    },
  });

  await assertScenario({
    templateDir,
    name: "core-feature-minor",
    async arrange(repoDir) {
      writeRepoFile(
        repoDir,
        "packages/convex-zen/src/index.ts",
        "export const core = 'feature';\n"
      );
      commitAll(repoDir, "feat(plugins): add flat build-time plugin authoring");
    },
    expectedReleaseTypes: {
      "convex-zen": "minor",
    },
  });

  await assertScenario({
    templateDir,
    name: "core-breaking-change",
    async arrange(repoDir) {
      writeRepoFile(
        repoDir,
        "packages/convex-zen/src/index.ts",
        "export const core = 'breaking';\n"
      );
      commitAll(
        repoDir,
        "feat(core)!: remove legacy child-component plugin model",
        "BREAKING CHANGE: built-in plugins now ship from convex-zen/plugins/*"
      );
    },
    expectedReleaseTypes: {
      "convex-zen": "major",
    },
  });

  await assertScenario({
    templateDir,
    name: "shared-release-script-patch",
    async arrange(repoDir) {
      writeRepoFile(
        repoDir,
        "scripts/release/stage-package.mjs",
        "export const stagePackage = true;\n"
      );
      commitAll(repoDir, "fix(release): adjust staged package publishing");
    },
    expectedReleaseTypes: {
      "convex-zen": "patch",
    },
  });

  await assertScenario({
    templateDir,
    name: "workspace-config-patch",
    async arrange(repoDir) {
      writeRepoFile(
        repoDir,
        "package.json",
        '{\n  "name": "release-harness",\n  "private": true\n}\n'
      );
      commitAll(repoDir, "fix(repo): update workspace release config");
    },
    expectedReleaseTypes: {
      "convex-zen": "patch",
    },
  });

  await assertScenario({
    templateDir,
    name: "docs-only",
    async arrange(repoDir) {
      writeRepoFile(repoDir, "README.md", "# Release harness\n\nUpdated docs.\n");
      commitAll(repoDir, "docs(repo): clarify root docs");
    },
    expectedReleaseTypes: {},
  });

  process.stdout.write("All release scenarios passed.\n");
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
