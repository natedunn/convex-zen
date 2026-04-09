const { execFileSync } = require("node:child_process");

const commitFilesCache = new Map();

function getCommitHash(commit) {
  if (typeof commit === "string") {
    return commit;
  }

  return commit?.hash ?? commit?.commit?.long ?? commit?.commit?.short ?? null;
}

function getCommitFiles({ cwd, commit }) {
  const commitHash = getCommitHash(commit);

  if (!commitHash) {
    throw new Error("Unable to determine commit hash for commit file lookup.");
  }

  const cacheKey = `${cwd}:${commitHash}`;
  const cached = commitFilesCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const output = execFileSync(
    "git",
    ["show", "--pretty=format:", "--name-only", "--first-parent", commitHash],
    {
      cwd,
      encoding: "utf8",
      env: process.env,
    }
  );

  const files = Array.from(
    new Set(
      output
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => line.replace(/\\/g, "/"))
    )
  );

  commitFilesCache.set(cacheKey, files);
  return files;
}

module.exports = {
  getCommitFiles,
};
