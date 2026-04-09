const fs = require("node:fs");
const path = require("node:path");

const { getPackageConfig } = require("../packages.cjs");

function rewriteWorkspaceVersionSpec(versionSpec, workspaceVersion) {
  if (!versionSpec.startsWith("workspace:")) {
    return versionSpec;
  }

  const range = versionSpec.slice("workspace:".length);

  if (range === "" || range === "*") {
    return workspaceVersion;
  }

  if (range === "^") {
    return `^${workspaceVersion}`;
  }

  if (range === "~") {
    return `~${workspaceVersion}`;
  }

  return range;
}

function rewriteDependencyMap(dependencyMap, repoRoot) {
  if (!dependencyMap) {
    return dependencyMap;
  }

  return Object.fromEntries(
    Object.entries(dependencyMap).map(([dependencyName, versionSpec]) => {
      if (typeof versionSpec !== "string" || !versionSpec.startsWith("workspace:")) {
        return [dependencyName, versionSpec];
      }

      const dependencyPackage = getPackageConfig(dependencyName);
      const dependencyPackageJsonPath = path.join(
        repoRoot,
        dependencyPackage.packageJsonPath
      );
      const dependencyPackageJson = JSON.parse(
        fs.readFileSync(dependencyPackageJsonPath, "utf8")
      );

      return [
        dependencyName,
        rewriteWorkspaceVersionSpec(versionSpec, dependencyPackageJson.version),
      ];
    })
  );
}

module.exports = {
  rewriteDependencyMap,
  rewriteWorkspaceVersionSpec,
};
