import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const version = process.argv[2];
const channel = process.argv[3];
const npmTag = channel && channel !== "undefined" ? channel : "latest";

if (!version) {
  throw new Error("Expected release version as the first argument.");
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");
const packageDirs = [
  path.join("packages", "convex-zen"),
  path.join("packages", "convex-zen-organization"),
  path.join("packages", "convex-zen-system-admin"),
];

for (const packageDir of packageDirs) {
  const stageDir = execFileSync(
    "node",
    [
      path.join(repoRoot, "scripts", "release", "stage-package.mjs"),
      packageDir,
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
    throw new Error(`Failed to stage ${packageDir} for publish.`);
  }

  process.stdout.write(
    `Publishing ${packageDir}@${version} with tag ${npmTag}.\n`
  );
  execFileSync("npm", ["publish", "--tag", npmTag], {
    cwd: stageDir,
    stdio: "inherit",
    env: process.env,
  });
}
