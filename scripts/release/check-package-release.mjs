import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { getPackageReleaseDecision } = require("./lib/package-release-decision.cjs");

const args = process.argv.slice(2);
let packageName = null;
let cwdArg = null;
let json = false;

for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];

  if (arg === "--json") {
    json = true;
    continue;
  }

  if (arg === "--cwd") {
    const nextArg = args[index + 1];

    if (!nextArg || nextArg.startsWith("--")) {
      throw new Error("Expected a path value after --cwd.");
    }

    cwdArg = nextArg;
    index += 1;
    continue;
  }

  if (!arg.startsWith("--") && !packageName) {
    packageName = arg;
    continue;
  }

  if (arg.startsWith("--")) {
    throw new Error(`Unknown option: ${arg}`);
  }

  throw new Error(`Unexpected argument: ${arg}`);
}

if (!packageName) {
  throw new Error("Expected a package name as the first non-flag argument.");
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const defaultRepoRoot = path.resolve(scriptDir, "..", "..");
const repoRoot = cwdArg ? path.resolve(cwdArg) : defaultRepoRoot;

const decision = await getPackageReleaseDecision({
  cwd: repoRoot,
  packageName,
});

if (json) {
  process.stdout.write(`${JSON.stringify(decision, null, 2)}\n`);
} else {
  process.stdout.write(
    [
      `package: ${decision.packageName}`,
      `currentVersion: ${decision.currentVersion}`,
      `lastReleaseTag: ${decision.lastReleaseTag ?? "(none)"}`,
      `releaseType: ${decision.releaseType ?? "(none)"}`,
      `nextVersion: ${decision.nextVersion ?? "(none)"}`,
      `relevantCommitCount: ${decision.relevantCommitCount}`,
    ].join("\n") + "\n"
  );
}
