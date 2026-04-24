const path = require("node:path");

const SHARED_RELEASE_PATHS = [
  "scripts/release/lib/**",
  "scripts/release/plugins/**",
  "scripts/release/packages.cjs",
  "scripts/release/prepare-package.mjs",
  "scripts/release/publish-package.mjs",
  "scripts/release/run-package-release.mjs",
  "scripts/release/stage-package.mjs",
  "package.json",
  "pnpm-lock.yaml",
  ".github/workflows/release.yml",
];

const PACKAGES = [
  {
    packageName: "convex-zen",
    pkgRoot: "packages/convex-zen",
    tagFormat: "convex-zen-v${version}",
    changelogFile: "packages/convex-zen/CHANGELOG.md",
    buildCommand: "pnpm --filter convex-zen build",
    releasePaths: ["packages/convex-zen/**", ...SHARED_RELEASE_PATHS],
    releaseCommitMessage:
      "chore(release): convex-zen ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}",
  },
];

function normalizeRepoPath(value) {
  return value.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+$/, "");
}

function normalizeReleasePath(value) {
  return normalizeRepoPath(value).replace(/\/\*\*$/, "");
}

function withDerivedFields(packageConfig) {
  return {
    ...packageConfig,
    packageJsonPath: path.posix.join(packageConfig.pkgRoot, "package.json"),
    readmePath: path.posix.join(packageConfig.pkgRoot, "README.md"),
  };
}

function getPackages() {
  return PACKAGES.map(withDerivedFields);
}

function getPackageConfig(packageName) {
  const packageConfig = getPackages().find(
    (candidate) => candidate.packageName === packageName
  );

  if (!packageConfig) {
    throw new Error(`Unknown release package: ${packageName}`);
  }

  return packageConfig;
}

function resolvePackageConfig(spec, repoRoot) {
  const normalizedSpec = normalizeRepoPath(spec);
  const relativeSpec = path.isAbsolute(spec)
    ? normalizeRepoPath(path.relative(repoRoot, spec))
    : normalizedSpec;

  const packageConfig = getPackages().find((candidate) => {
    if (candidate.packageName === spec || candidate.packageName === normalizedSpec) {
      return true;
    }

    if (candidate.pkgRoot === normalizedSpec || candidate.pkgRoot === relativeSpec) {
      return true;
    }

    return (
      path.basename(candidate.pkgRoot) === normalizedSpec ||
      path.basename(candidate.pkgRoot) === relativeSpec
    );
  });

  if (!packageConfig) {
    throw new Error(`Unknown release package specifier: ${spec}`);
  }

  return packageConfig;
}

function matchesReleasePath(filePath, releasePath) {
  const normalizedFilePath = normalizeRepoPath(filePath);
  const normalizedReleasePath = normalizeReleasePath(releasePath);

  return (
    normalizedFilePath === normalizedReleasePath ||
    normalizedFilePath.startsWith(`${normalizedReleasePath}/`)
  );
}

function matchesPackagePath(filePath, packageConfig) {
  return packageConfig.releasePaths.some((releasePath) =>
    matchesReleasePath(filePath, releasePath)
  );
}

module.exports = {
  getPackageConfig,
  getPackages,
  matchesPackagePath,
  normalizeReleasePath,
  normalizeRepoPath,
  resolvePackageConfig,
};
