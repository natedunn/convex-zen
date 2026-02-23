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
      "@semantic-release/npm",
      {
        pkgRoot: "packages/convex-zen",
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
          "packages/convex-zen/CHANGELOG.md",
        ],
        message:
          "chore(release): convex-zen ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}",
      },
    ],
  ],
};
