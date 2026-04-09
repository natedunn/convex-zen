import { execFileSync } from "node:child_process";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { resolvePackageConfig } = require("./packages.cjs");

const packageSpecifier = process.argv[2];
const version = process.argv[3];
const channel = process.argv[4];
const npmTag = channel && channel !== "undefined" ? channel : "latest";

if (!packageSpecifier || !version) {
  throw new Error("Expected package name and version arguments.");
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");
const packageConfig = resolvePackageConfig(packageSpecifier, repoRoot);

const stageDir = execFileSync(
  "node",
  [
    path.join(repoRoot, "scripts", "release", "stage-package.mjs"),
    packageConfig.packageName,
    version,
  ],
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
  throw new Error(`Failed to stage ${packageConfig.packageName} for publish.`);
}

process.stdout.write(
  `Publishing ${packageConfig.packageName}@${version} with tag ${npmTag}.\n`
);
execFileSync("npm", ["publish", "--tag", npmTag], {
  cwd: stageDir,
  stdio: "inherit",
  env: process.env,
});
