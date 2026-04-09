import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { getPackages } = require("./packages.cjs");
const { getPackageReleaseDecision } = require("./lib/package-release-decision.cjs");

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

function runInherit(command, args, cwd) {
  execFileSync(command, args, {
    cwd,
    stdio: "inherit",
    env: process.env,
  });
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
  writeRepoFile(templateDir, "scripts/release/README.md", "release docs\n");

  for (const packageConfig of getPackages()) {
    const sourcePackageJson = readJson(path.join(repoRoot, packageConfig.packageJsonPath));
    const packageJson = {
      name: sourcePackageJson.name,
      version: sourcePackageJson.version,
    };

    if (sourcePackageJson.dependencies) {
      packageJson.dependencies = sourcePackageJson.dependencies;
    }

    writeRepoFile(
      templateDir,
      packageConfig.packageJsonPath,
      `${JSON.stringify(packageJson, null, 2)}\n`
    );
    writeRepoFile(
      templateDir,
      path.posix.join(packageConfig.pkgRoot, "src/index.ts"),
      `export const ${packageConfig.packageName.replace(/-/g, "_")} = true;\n`
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

function incrementVersion(version, releaseType) {
  const [majorText, minorText, patchText] = version.split(".");
  let major = Number(majorText);
  let minor = Number(minorText);
  let patch = Number(patchText);

  switch (releaseType) {
    case "major":
      major += 1;
      minor = 0;
      patch = 0;
      break;
    case "minor":
      minor += 1;
      patch = 0;
      break;
    case "patch":
      patch += 1;
      break;
    default:
      throw new Error(`Unsupported release type: ${releaseType}`);
  }

  return `${major}.${minor}.${patch}`;
}

async function assertScenario({
  templateDir,
  name,
  arrange,
  expectedReleaseTypes,
  expectedNextVersions = {},
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
        : expectedNextVersions[packageConfig.packageName] ??
          incrementVersion(baselineVersions[packageConfig.packageName], expectedReleaseType);

    assert.equal(
      decision.nextVersion,
      expectedNextVersion,
      `${name}: expected ${packageConfig.packageName} nextVersion ${expectedNextVersion}, got ${decision.nextVersion}`
    );
  }

  process.stdout.write(`PASS ${name}\n`);
}

const templateDir = path.join(tempRoot, "template");
mkdirSync(templateDir, { recursive: true });
seedPackageRepo(templateDir);

try {
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
    name: "organization-only-feature",
    async arrange(repoDir) {
      writeRepoFile(
        repoDir,
        "packages/convex-zen-organization/src/index.ts",
        "export const organization = 'feature';\n"
      );
      commitAll(repoDir, "feat(organization): add organization feature");
    },
    expectedReleaseTypes: {
      "convex-zen-organization": "minor",
    },
  });

  await assertScenario({
    templateDir,
    name: "system-admin-breaking",
    async arrange(repoDir) {
      writeRepoFile(
        repoDir,
        "packages/convex-zen-system-admin/src/index.ts",
        "export const systemAdmin = 'breaking';\n"
      );
      commitAll(
        repoDir,
        "feat(system-admin)!: remove legacy system admin path",
        "BREAKING CHANGE: remove the legacy system admin path"
      );
    },
    expectedReleaseTypes: {
      "convex-zen-system-admin": "major",
    },
  });

  await assertScenario({
    templateDir,
    name: "core-and-organization-feature",
    async arrange(repoDir) {
      writeRepoFile(
        repoDir,
        "packages/convex-zen/src/index.ts",
        "export const core = 'minor';\n"
      );
      writeRepoFile(
        repoDir,
        "packages/convex-zen-organization/src/index.ts",
        "export const organization = 'minor';\n"
      );
      commitAll(repoDir, "feat(shared): update core and organization together");
    },
    expectedReleaseTypes: {
      "convex-zen": "minor",
      "convex-zen-organization": "minor",
    },
  });

  await assertScenario({
    templateDir,
    name: "release-infra-only",
    async arrange(repoDir) {
      writeRepoFile(repoDir, "scripts/release/README.md", "release docs updated\n");
      commitAll(repoDir, "fix(ci): tweak release docs");
    },
    expectedReleaseTypes: {},
  });

  await assertScenario({
    templateDir,
    name: "organization-docs-only",
    async arrange(repoDir) {
      writeRepoFile(
        repoDir,
        "packages/convex-zen-organization/README.md",
        "# convex-zen-organization\n\nUpdated docs.\n"
      );
      commitAll(repoDir, "docs(organization): clarify organization docs");
    },
    expectedReleaseTypes: {},
  });

  process.stdout.write("All release scenarios passed.\n");
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
