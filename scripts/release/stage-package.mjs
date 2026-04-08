import { access, cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");
const packageDirArg = process.argv[2];
const version = process.argv[3];

if (!packageDirArg || !version) {
  throw new Error("Expected package directory and version arguments.");
}

const packageDir = path.resolve(repoRoot, packageDirArg);
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

await cp(path.join(packageDir, "dist"), path.join(stageDir, "dist"), {
  recursive: true,
});

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

const publishedPackageJson = {
  ...packageJson,
  version,
  main: replaceImportPath(packageJson.main),
  types: replaceTypesPath(packageJson.types),
  exports: transformExports(packageJson.exports),
  files: ["dist", "README.md", "LICENSE"],
};

if (publishedPackageJson.dependencies?.["convex-zen"] === "workspace:*") {
  publishedPackageJson.dependencies["convex-zen"] = version;
}

delete publishedPackageJson.publishConfig;
delete publishedPackageJson.devDependencies;

await writeFile(
  path.join(stageDir, "package.json"),
  `${JSON.stringify(publishedPackageJson, null, 2)}\n`
);

process.stdout.write(`${stageDir}\n`);
