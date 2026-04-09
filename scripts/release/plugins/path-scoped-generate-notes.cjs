const {
  generateNotes: generateConventionalNotes,
} = require("@semantic-release/release-notes-generator");
const { createScopedContext } = require("../lib/filter-package-commits.cjs");

module.exports = {
  async generateNotes(pluginConfig, context) {
    const { packageName, ...delegateConfig } = pluginConfig;
    const scopedContext = await createScopedContext({ context, packageName });

    if (scopedContext.commits.length === 0) {
      return "";
    }

    return generateConventionalNotes(delegateConfig, scopedContext);
  },
};
