import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const version = process.argv[2];

if (!version) {
  throw new Error("Expected release version as the first argument.");
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");
const packagePaths = [
  path.join(repoRoot, "packages", "convex-zen", "package.json"),
  path.join(repoRoot, "packages", "convex-zen-organization", "package.json"),
  path.join(repoRoot, "packages", "convex-zen-system-admin", "package.json"),
];

for (const packagePath of packagePaths) {
  const source = await readFile(packagePath, "utf8");
  const packageJson = JSON.parse(source);
  packageJson.version = version;
  await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);
}

process.stdout.write(`Prepared package versions for ${version}.\n`);
