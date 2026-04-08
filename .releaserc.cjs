module.exports = {
  branches: ["main"],
  tagFormat: "convex-zen-v${version}",
  plugins: [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    [
      "@semantic-release/changelog",
      {
        changelogFile: "packages/convex-zen/CHANGELOG.md",
      },
    ],
    [
      "@semantic-release/exec",
      {
        prepareCmd:
          "node scripts/release/prepare-packages.mjs ${nextRelease.version}",
        publishCmd:
          "node scripts/release/publish-packages.mjs ${nextRelease.version} ${nextRelease.channel}",
      },
    ],
    [
      "@semantic-release/github",
      {
        labels: false,
        failComment: false,
      },
    ],
    [
      "@semantic-release/git",
      {
        assets: [
          "packages/convex-zen/package.json",
          "packages/convex-zen-organization/package.json",
          "packages/convex-zen-system-admin/package.json",
          "packages/convex-zen/CHANGELOG.md",
        ],
        message:
          "chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}",
      },
    ],
  ],
};
