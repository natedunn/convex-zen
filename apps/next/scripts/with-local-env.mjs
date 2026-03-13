import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

function stripInlineComment(value) {
  let quote = null;
  let escaped = false;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (quote) {
      if (char === quote) {
        quote = null;
      }
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }
    if (char === "#" && (index === 0 || /\s/.test(value[index - 1]))) {
      return value.slice(0, index).trimEnd();
    }
  }

  return value.trimEnd();
}

function parseEnvFile(envPath) {
  const source = readFileSync(envPath, "utf8");
  const env = {};

  for (const rawLine of source.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const normalized = line.startsWith("export ") ? line.slice(7).trim() : line;
    const separatorIndex = normalized.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = normalized.slice(0, separatorIndex).trim();
    if (!key) {
      continue;
    }

    const rawValue = stripInlineComment(normalized.slice(separatorIndex + 1).trim());
    const isQuoted =
      rawValue.length >= 2 &&
      ((rawValue.startsWith('"') && rawValue.endsWith('"')) ||
        (rawValue.startsWith("'") && rawValue.endsWith("'")));
    env[key] = isQuoted ? rawValue.slice(1, -1) : rawValue;
  }

  return env;
}

function getRepoRoot(cwd) {
  const result = spawnSync("git", ["rev-parse", "--show-toplevel"], {
    cwd,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || "Unable to determine repository root.");
  }
  return result.stdout.trim();
}

function getWorktreeRoots(repoRoot) {
  const result = spawnSync("git", ["worktree", "list", "--porcelain"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    return [];
  }

  return result.stdout
    .split(/\r?\n/u)
    .filter((line) => line.startsWith("worktree "))
    .map((line) => line.slice("worktree ".length).trim());
}

function resolveEnvFiles(appDir) {
  const localEnvPath = path.join(appDir, ".env.local");
  const repoRoot = getRepoRoot(appDir);
  const relativeAppPath = path.relative(repoRoot, appDir);
  const siblingEnvPaths = [];
  for (const worktreeRoot of getWorktreeRoots(repoRoot)) {
    if (path.resolve(worktreeRoot) === path.resolve(appDir, "..", "..")) {
      continue;
    }

    const candidate = path.join(worktreeRoot, relativeAppPath, ".env.local");
    if (existsSync(candidate)) {
      siblingEnvPaths.push(candidate);
    }
  }

  return {
    localEnvPath: existsSync(localEnvPath) ? localEnvPath : null,
    siblingEnvPaths,
  };
}

function parseArgs(argv) {
  const required = [];
  const command = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--") {
      command.push(...argv.slice(index + 1));
      break;
    }
    if (arg === "--require") {
      const name = argv[index + 1];
      if (!name) {
        throw new Error("Missing variable name after --require.");
      }
      required.push(name);
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (command.length === 0) {
    throw new Error("Missing command to run.");
  }

  return { command, required };
}

function failForMissingVars(missingVars, appDir, envResolution) {
  const relativeAppPath = path.relative(getRepoRoot(appDir), appDir) || ".";
  const missingList = missingVars.join(", ");
  const setupHint =
    !envResolution.localEnvPath && envResolution.siblingEnvPaths.length === 0
      ? [
          `No ${path.join(relativeAppPath, ".env.local")} was found in this worktree or any sibling worktree.`,
          `Copy an existing .env.local into this app, or run the app once from the base repo so the file exists there.`,
        ]
      : [
          `Loaded env from the available app .env.local files, but they are still missing ${missingList}.`,
          `Update the app .env.local in the base repo or this worktree, then retry.`,
        ];

  console.error(`Missing required environment variable${missingVars.length > 1 ? "s" : ""}: ${missingList}`);
  for (const line of setupHint) {
    console.error(line);
  }
  process.exit(1);
}

const appDir = process.cwd();
const { command, required } = parseArgs(process.argv.slice(2));
const envResolution = resolveEnvFiles(appDir);
const envSources = [
  ...envResolution.siblingEnvPaths.map((envPath) => ({
    envPath,
    source: "worktree",
  })),
  ...(envResolution.localEnvPath
    ? [{ envPath: envResolution.localEnvPath, source: "local" }]
    : []),
];

for (const { envPath } of envSources) {
  const fileEnv = parseEnvFile(envPath);
  for (const [key, value] of Object.entries(fileEnv)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

if (!envResolution.localEnvPath && envResolution.siblingEnvPaths.length > 0) {
  const relativeEnvPath =
    path.relative(appDir, envResolution.siblingEnvPaths[0]) || ".env.local";
  console.error(`Using shared app env from ${relativeEnvPath}`);
} else if (envResolution.localEnvPath && envResolution.siblingEnvPaths.length > 0) {
  const fallbackNames = envResolution.siblingEnvPaths
    .map((envPath) => path.relative(appDir, envPath) || ".env.local")
    .join(", ");
  console.error(`Supplementing local app env with shared values from ${fallbackNames}`);
}

const missingVars = required.filter((name) => {
  const value = process.env[name];
  return value === undefined || value === "";
});
if (missingVars.length > 0) {
  failForMissingVars(missingVars, appDir, envResolution);
}

const [bin, ...args] = command;
const child = spawnSync(bin, args, {
  cwd: appDir,
  env: process.env,
  stdio: "inherit",
});

if (child.error) {
  console.error(child.error.message);
  process.exit(1);
}

if (child.signal) {
  process.kill(process.pid, child.signal);
}

process.exit(child.status ?? 0);
