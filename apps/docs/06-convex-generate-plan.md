# 06 - Convex Function Generation Plan

## Goal

Generate app-side Convex auth functions from `convex/auth/index.ts` so users do not hand-maintain wrappers as core/plugin features evolve.

Primary command:

- `npx convex-zen generate`

## Required File Layout (App)

- `convex/auth/index.ts` (user-authored)
  - exports `authOptions` (serializable config object)
  - exports `auth` (`new ConvexAuth(...)`)
- `convex/auth/core.ts` (generated)
- `convex/auth/admin.ts` (generated if admin plugin enabled)
- future plugin files: `convex/auth/<plugin>.ts` (generated)

`convex/_generated/*` remains Convex-owned and is never written by this generator.

## Generator Contract

Input:

- `convex/auth/index.ts` as the source of truth for enabled plugins and auth config.

Output:

- Deterministic generated Convex function wrappers using `action/query/mutation`.
- Idempotent writes with a generated-file header marker.
- `--check` mode for CI drift detection.

Safety:

- Only overwrite files with generated header.
- Never mutate user-authored files.

## CLI Plan (`convex-zen` package)

Add a package CLI entrypoint:

- `convex-zen generate`

Flags:

- `--cwd <path>` (default process cwd)
- `--check`
- `--verbose`

Behavior:

1. Load app auth module from `<cwd>/convex/auth/index.ts`.
2. Read `authOptions` and resolve enabled plugin ids.
3. Emit `convex/auth/core.ts`.
4. Emit plugin files for enabled plugins (`admin.ts` first).
5. Print summary of created/updated/unchanged files.
6. Exit non-zero in `--check` mode if files are stale.

## Core Scope (v1)

Generate wrappers for:

- `signUp`
- `signInWithEmail`
- `verifyEmail`
- `requestPasswordReset`
- `resetPassword`
- `signOut`
- `validateSession`
- `currentUser`
- OAuth helpers where configured

Admin plugin wrappers (when enabled):

- `adminListUsers`
- `adminBanUser`
- `adminSetRole`
- `adminUnbanUser`
- `adminDeleteUser`

## Acceptance Criteria

1. New app can run:
   - `npx convex-zen generate`
   - `npx convex codegen`
   - `npx convex dev`
   with no manual function-wrapper edits.
2. Removing a plugin from `authOptions.plugins` removes corresponding generated plugin file.
3. `--check` fails if generated files are out of date.
4. Generated functions are fully typed in `api.*`.

## Local test (before first publish)

1. Implement CLI + generator.
2. Run in workspace example app (`apps/tanstack`).
3. Build + typecheck:
   - `pnpm -C packages/convex-zen build`
   - `pnpm -C apps/tanstack build`
4. Pack and install exactly what npm users will receive:
   - `pnpm -C packages/convex-zen pack`
   - install tarball in a clean test app and run `npx convex-zen generate`.

## First publish recommendation

Publish first time only after the tarball test above succeeds in a clean app.

Start with a pre-release tag (for example `0.1.0-alpha.1`) to validate real-world setup before stable.

## Open Decisions

1. Should `authOptions` become a required export in `convex/auth/index.ts`?
2. Should generator also create a barrel file (`convex/auth/generated.ts`) for explicit imports?
3. Should OAuth wrappers be generated conditionally by provider config, or always generated?

## Current Implementation Status

Implemented now:

1. `convex-zen` CLI with `generate` command.
2. Generated files:
   - `convex/auth/core.ts`
   - `convex/auth/admin.ts` when admin plugin is detected.
3. Safety guard:
   - generated marker required for overwrite/delete.
4. Drift check:
   - `convex-zen generate --check`.
5. App auth layout:
   - `convex/auth/index.ts` as source of truth.

Current detection behavior:

- Admin plugin detection is currently regex-based (`adminPlugin(...)`) from `convex/auth/index.ts`.
- `authOptions` export is recommended and warned when missing.
