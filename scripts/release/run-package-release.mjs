import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const semanticRelease = require("semantic-release").default;
const { getPackageConfig } = require("./packages.cjs");

const args = process.argv.slice(2);
const packageName = args.find((arg) => !arg.startsWith("--"));

if (!packageName) {
  throw new Error("Expected a package name as the first non-flag argument.");
}

const dryRun = args.includes("--dry-run");
const ci = args.includes("--no-ci") ? false : undefined;

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");
const packageConfig = getPackageConfig(packageName);
const analyzePluginPath = path.join(
  repoRoot,
  "scripts",
  "release",
  "plugins",
  "path-scoped-analyze-commits.cjs"
);
const notesPluginPath = path.join(
  repoRoot,
  "scripts",
  "release",
  "plugins",
  "path-scoped-generate-notes.cjs"
);

function writeGitHubOutput(key, value) {
  if (!process.env.GITHUB_OUTPUT) {
    return;
  }

  const serializedValue = value == null ? "" : String(value);
  process.stdout.write(`GitHub output ${key}=${serializedValue}\n`);
  require("node:fs").appendFileSync(
    process.env.GITHUB_OUTPUT,
    `${key}=${serializedValue}\n`
  );
}

const releaseOptions = {
  branches: ["main"],
  dryRun,
  tagFormat: packageConfig.tagFormat,
  plugins: [
    [analyzePluginPath, { packageName }],
    [notesPluginPath, { packageName }],
    [
      "@semantic-release/changelog",
      {
        changelogFile: packageConfig.changelogFile,
      },
    ],
    [
      "@semantic-release/exec",
      {
        prepareCmd: `node scripts/release/prepare-package.mjs ${packageConfig.packageName} \${nextRelease.version}`,
        publishCmd: `node scripts/release/publish-package.mjs ${packageConfig.packageName} \${nextRelease.version} \${nextRelease.channel}`,
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
          packageConfig.packageJsonPath,
          packageConfig.changelogFile,
        ],
        message: packageConfig.releaseCommitMessage,
      },
    ],
  ],
};

if (ci !== undefined) {
  releaseOptions.ci = ci;
}

const result = await semanticRelease(releaseOptions, {
  cwd: repoRoot,
  env: process.env,
  stdout: process.stdout,
  stderr: process.stderr,
});

if (!result) {
  writeGitHubOutput("released", "false");
  writeGitHubOutput("version", "");
  writeGitHubOutput("tag", "");
  process.stdout.write(`No release published for ${packageConfig.packageName}.\n`);
} else {
  const tag = packageConfig.tagFormat.replace(
    "${version}",
    result.nextRelease.version
  );

  writeGitHubOutput("released", "true");
  writeGitHubOutput("version", result.nextRelease.version);
  writeGitHubOutput("tag", tag);
  process.stdout.write(
    `Released ${packageConfig.packageName}@${result.nextRelease.version}.\n`
  );
}
