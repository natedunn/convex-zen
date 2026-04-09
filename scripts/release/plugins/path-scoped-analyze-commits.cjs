const {
  analyzeCommits: analyzeConventionalCommits,
} = require("@semantic-release/commit-analyzer");
const { createScopedContext } = require("../lib/filter-package-commits.cjs");

module.exports = {
  async analyzeCommits(pluginConfig, context) {
    const { packageName, ...delegateConfig } = pluginConfig;
    const scopedContext = await createScopedContext({ context, packageName });

    if (scopedContext.commits.length === 0) {
      context.logger.log("No relevant commits for %s.", packageName);
      return null;
    }

    return analyzeConventionalCommits(delegateConfig, scopedContext);
  },
};
