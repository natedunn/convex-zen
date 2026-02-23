#!/usr/bin/env node

import path from "node:path";
import process from "node:process";
import {
  generateAuthFunctions,
  type GenerateOptions,
  type GenerateResult,
} from "./generate.js";

function printHelp(): void {
  console.log(`convex-zen CLI

Usage:
  convex-zen generate [--cwd <path>] [--check] [--verbose]

Commands:
  generate    Generate Convex auth function wrappers in convex/auth/

Flags:
  --cwd       Workspace root (default: current working directory)
  --check     Check for drift without writing files
  --verbose   Print additional details
  -h, --help  Show this help message
`);
}

function parseArgs(argv: string[]): {
  command: string | null;
  options: GenerateOptions;
} {
  let command: string | null = null;
  const options: GenerateOptions = {
    cwd: process.cwd(),
    check: false,
    verbose: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg) {
      continue;
    }
    if (arg === "-h" || arg === "--help") {
      return { command: null, options };
    }
    if (!command && !arg.startsWith("-")) {
      command = arg;
      continue;
    }
    if (arg === "--check") {
      options.check = true;
      continue;
    }
    if (arg === "--verbose") {
      options.verbose = true;
      continue;
    }
    if (arg === "--cwd") {
      const next = argv[i + 1];
      if (!next) {
        throw new Error("--cwd requires a path value");
      }
      options.cwd = path.resolve(next);
      i += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return { command, options };
}

function printSummary(result: GenerateResult): void {
  const totalChanges =
    result.created.length + result.updated.length + result.deleted.length;

  console.log("convex-zen generate summary");
  console.log(`  created:  ${result.created.length}`);
  console.log(`  updated:  ${result.updated.length}`);
  console.log(`  deleted:  ${result.deleted.length}`);
  console.log(`  unchanged:${result.unchanged.length}`);
  if (totalChanges === 0) {
    console.log("  status:   up-to-date");
  }

  for (const warning of result.warnings) {
    console.warn(`warning: ${warning}`);
  }
}

async function main(): Promise<void> {
  const { command, options } = parseArgs(process.argv.slice(2));
  if (!command) {
    printHelp();
    return;
  }

  if (command !== "generate") {
    throw new Error(`Unknown command: ${command}`);
  }

  const result = await generateAuthFunctions(options);
  printSummary(result);

  if (options.verbose) {
    for (const file of result.created) {
      console.log(`created: ${file}`);
    }
    for (const file of result.updated) {
      console.log(`updated: ${file}`);
    }
    for (const file of result.deleted) {
      console.log(`deleted: ${file}`);
    }
  }

  if (options.check) {
    const hasDrift =
      result.created.length > 0 ||
      result.updated.length > 0 ||
      result.deleted.length > 0;
    if (hasDrift) {
      throw new Error("Generated auth function files are out of date.");
    }
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`convex-zen: ${message}`);
  process.exit(1);
});
