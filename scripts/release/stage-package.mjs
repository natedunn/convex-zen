import { access, cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { resolvePackageConfig } = require("./packages.cjs");
const { rewriteDependencyMap } = require("./lib/workspace-dependencies.cjs");

function replaceImportPath(value) {
  if (typeof value !== "string") {
    return value;
  }
  return value.replace(/^\.\/src\//, "./dist/").replace(/\.ts$/, ".js");
}

function replaceTypesPath(value) {
  if (typeof value !== "string") {
    return value;
  }
  return value.replace(/^\.\/src\//, "./dist/").replace(/\.ts$/, ".d.ts");
}

function transformExports(exportsField) {
  if (typeof exportsField === "string") {
    return replaceImportPath(exportsField);
  }
  if (!exportsField || typeof exportsField !== "object") {
    return exportsField;
  }

  return Object.fromEntries(
    Object.entries(exportsField).map(([key, value]) => {
      if (value && typeof value === "object" && !Array.isArray(value)) {
        return [
          key,
          Object.fromEntries(
            Object.entries(value).map(([innerKey, innerValue]) => {
              if (innerKey === "types") {
                return [innerKey, replaceTypesPath(innerValue)];
              }
              return [innerKey, replaceImportPath(innerValue)];
            })
          ),
        ];
      }
      return [key, transformExports(value)];
    })
  );
}

async function copyConfiguredPackageFiles(packageDir, stageDir, filesField) {
  if (!Array.isArray(filesField)) {
    return [];
  }

  const copiedFiles = [];

  for (const entry of filesField) {
    if (typeof entry !== "string" || entry === "README.md" || entry === "LICENSE") {
      continue;
    }

    const sourcePath = path.join(packageDir, entry);

    try {
      await access(sourcePath);
    } catch (error) {
      throw new Error(
        `Configured package file "${entry}" does not exist in ${packageDir}. Refusing to stage a package with missing package.json "files" entries.`,
        { cause: error }
      );
    }

    await cp(sourcePath, path.join(stageDir, entry), {
      recursive: true,
    });
    copiedFiles.push(entry);
  }

  return copiedFiles;
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");
const packageSpecifier = process.argv[2];
const version = process.argv[3];

if (!packageSpecifier || !version) {
  throw new Error("Expected package name and version arguments.");
}

const packageConfig = resolvePackageConfig(packageSpecifier, repoRoot);
const packageDir = path.join(repoRoot, packageConfig.pkgRoot);
const packageJsonPath = path.join(packageDir, "package.json");
const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
const stageRoot = path.join(repoRoot, ".release-tmp");
const stageDir = path.join(stageRoot, packageJson.name);

await rm(stageDir, { recursive: true, force: true });
await mkdir(stageDir, { recursive: true });

const buildScript =
  packageJson.scripts && typeof packageJson.scripts["build:dist"] === "string"
    ? "build:dist"
    : "build";

process.stdout.write(`Building ${packageJson.name} with ${buildScript}.\n`);

const { execFileSync } = await import("node:child_process");
execFileSync("pnpm", ["run", buildScript], {
  cwd: packageDir,
  stdio: "inherit",
  env: process.env,
});

const copiedFiles = await copyConfiguredPackageFiles(
  packageDir,
  stageDir,
  packageJson.files
);

const readmePath = path.join(packageDir, "README.md");
let resolvedReadmePath = readmePath;
try {
  await access(resolvedReadmePath);
} catch {
  resolvedReadmePath = path.join(repoRoot, "README.md");
}
await cp(resolvedReadmePath, path.join(stageDir, "README.md"));

const licensePath = path.join(repoRoot, "LICENSE");
await cp(licensePath, path.join(stageDir, "LICENSE"));

const publishedFiles = Array.from(
  new Set([...copiedFiles, "README.md", "LICENSE"])
);

const publishedPackageJson = {
  ...packageJson,
  version,
  main: replaceImportPath(packageJson.main),
  types: replaceTypesPath(packageJson.types),
  exports: transformExports(packageJson.exports),
  dependencies: rewriteDependencyMap(packageJson.dependencies, repoRoot),
  optionalDependencies: rewriteDependencyMap(
    packageJson.optionalDependencies,
    repoRoot
  ),
  peerDependencies: rewriteDependencyMap(
    packageJson.peerDependencies,
    repoRoot
  ),
  files: publishedFiles,
};

delete publishedPackageJson.publishConfig;
delete publishedPackageJson.devDependencies;

await writeFile(
  path.join(stageDir, "package.json"),
  `${JSON.stringify(publishedPackageJson, null, 2)}\n`
);

process.stdout.write(`${stageDir}\n`);
