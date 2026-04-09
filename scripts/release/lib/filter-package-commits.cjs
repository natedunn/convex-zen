const {
  getPackageConfig,
  matchesPackagePath,
} = require("../packages.cjs");
const { getCommitFiles } = require("./get-commit-files.cjs");

async function filterPackageCommits({ cwd, commits, packageName, logger }) {
  const packageConfig = getPackageConfig(packageName);
  const relevantCommits = (commits ?? []).filter((commit) =>
    getCommitFiles({ cwd, commit }).some((filePath) =>
      matchesPackagePath(filePath, packageConfig)
    )
  );

  if (logger) {
    logger.log(
      "Found %d relevant commits for %s out of %d commits since %s.",
      relevantCommits.length,
      packageName,
      commits?.length ?? 0,
      packageConfig.tagFormat
    );
  }

  return relevantCommits;
}

async function createScopedContext({ context, packageName }) {
  const filteredCommits = await filterPackageCommits({
    cwd: context.cwd,
    commits: context.commits,
    packageName,
    logger: context.logger,
  });

  return {
    ...context,
    commits: filteredCommits,
  };
}

module.exports = {
  createScopedContext,
  filterPackageCommits,
};
