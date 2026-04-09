const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const { filterPackageCommits } = require("./filter-package-commits.cjs");
const analyzePlugin = require("../plugins/path-scoped-analyze-commits.cjs");
const { getPackageConfig } = require("../packages.cjs");

const NULL_LOGGER = {
  log() {},
  error() {},
  success() {},
};

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractVersionFromTag(tag, tagFormat) {
  const pattern = new RegExp(
    `^${escapeRegex(tagFormat).replace("\\$\\{version\\}", "(.+)")}$`
  );
  const match = tag.match(pattern);

  if (!match) {
    throw new Error(`Tag ${tag} does not match expected format ${tagFormat}.`);
  }

  return match[1];
}

function getLatestPackageTag({ cwd, packageConfig }) {
  const pattern = packageConfig.tagFormat.replace("${version}", "*");
  const output = execFileSync(
    "git",
    ["tag", "--list", pattern, "--sort=-version:refname"],
    {
      cwd,
      encoding: "utf8",
      env: process.env,
    }
  ).trim();

  if (!output) {
    return null;
  }

  return output.split("\n")[0];
}

function getCommitsSinceTag({ cwd, lastReleaseTag }) {
  const range = lastReleaseTag ? `${lastReleaseTag}..HEAD` : "HEAD";
  const output = execFileSync(
    "git",
    ["log", range, "--format=%H%x1f%B%x1e"],
    {
      cwd,
      encoding: "utf8",
      env: process.env,
    }
  );

  return output
    .split("\x1e")
    .map((record) => record.trim())
    .filter(Boolean)
    .map((record) => {
      const [hash, rawMessage = ""] = record.split("\x1f");
      const message = rawMessage.trimEnd();
      const [subject = ""] = message.split("\n");

      return {
        hash,
        message,
        subject,
      };
    });
}

function incrementVersion(version, releaseType) {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);

  if (!match) {
    throw new Error(`Unsupported version format: ${version}`);
  }

  const [, majorText, minorText, patchText] = match;
  let major = Number(majorText);
  let minor = Number(minorText);
  let patch = Number(patchText);

  switch (releaseType) {
    case "major":
      major += 1;
      minor = 0;
      patch = 0;
      break;
    case "minor":
      minor += 1;
      patch = 0;
      break;
    case "patch":
      patch += 1;
      break;
    default:
      throw new Error(`Unsupported release type: ${releaseType}`);
  }

  return `${major}.${minor}.${patch}`;
}

async function getPackageReleaseDecision({
  cwd,
  packageName,
  logger = NULL_LOGGER,
}) {
  const packageConfig = getPackageConfig(packageName);
  const packageJsonPath = path.join(cwd, packageConfig.packageJsonPath);
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  const lastReleaseTag = getLatestPackageTag({ cwd, packageConfig });
  const lastReleaseVersion = lastReleaseTag
    ? extractVersionFromTag(lastReleaseTag, packageConfig.tagFormat)
    : packageJson.version;
  const commits = getCommitsSinceTag({ cwd, lastReleaseTag });
  const relevantCommits = await filterPackageCommits({
    cwd,
    commits,
    packageName,
    logger,
  });
  const releaseType =
    relevantCommits.length === 0
      ? null
      : await analyzePlugin.analyzeCommits(
          { packageName },
          {
            cwd,
            commits,
            logger,
          }
        );

  return {
    packageName,
    currentVersion: packageJson.version,
    lastReleaseTag,
    lastReleaseVersion,
    commitCount: commits.length,
    relevantCommitCount: relevantCommits.length,
    relevantCommits: relevantCommits.map((commit) => ({
      hash: commit.hash,
      subject: commit.subject,
      message: commit.message,
    })),
    releaseType,
    nextVersion: releaseType
      ? incrementVersion(lastReleaseVersion, releaseType)
      : null,
  };
}

module.exports = {
  extractVersionFromTag,
  getCommitsSinceTag,
  getLatestPackageTag,
  getPackageReleaseDecision,
  incrementVersion,
};
