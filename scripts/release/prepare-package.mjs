import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { resolvePackageConfig } = require("./packages.cjs");

const packageSpecifier = process.argv[2];
const version = process.argv[3];

if (!packageSpecifier || !version) {
  throw new Error("Expected package name and version arguments.");
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");
const packageConfig = resolvePackageConfig(packageSpecifier, repoRoot);
const packageJsonPath = path.join(repoRoot, packageConfig.packageJsonPath);

const source = await readFile(packageJsonPath, "utf8");
const packageJson = JSON.parse(source);
packageJson.version = version;

await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);

process.stdout.write(
  `Prepared ${packageConfig.packageName} package version for ${version}.\n`
);
