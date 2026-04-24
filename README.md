# convex-zen

Production-grade authentication for Convex, built as a reusable component package.

`convex-zen` is a native Convex auth component and an alternative to:

- the Better Auth Convex component: https://github.com/get-convex/better-auth
- Convex Auth: https://labs.convex.dev/auth

## Supported Today

- Next.js App Router
- TanStack Start

The canonical framework examples live in:

- `apps/next`
- `apps/tanstack`

## Start Here

For agents and one-shot installs, start with:

1. `LLMS.md`
2. `npx convex-zen doctor`
3. the scenario doc returned by `doctor`

Public install docs live under `apps/docs/external/install`.

## Choose Your Starting Point

| Project state | Recommended command | Doc |
| --- | --- | --- |
| Existing Next.js app with Convex, no auth | `npx convex-zen doctor` | `apps/docs/external/install/next/add-to-existing-convex.md` |
| Existing TanStack Start app with Convex, no auth | `npx convex-zen doctor` | `apps/docs/external/install/tanstack-start/add-to-existing-convex.md` |
| Existing Next.js app using Convex Auth | `npx convex-zen doctor` | `apps/docs/external/install/next/migrate-from-convex-auth.md` |
| Existing TanStack Start app using Better Auth | `npx convex-zen doctor` | `apps/docs/external/install/tanstack-start/migrate-from-better-auth.md` |
| Framework app exists but Convex does not | `npx convex-zen doctor` | framework `from-scratch.md` guide |
| No supported framework app yet | read `apps/docs/external/install/README.md` | install overview |

## Install Model

The canonical setup model is:

1. author `convex/zen.config.ts`
2. add `convex/auth.config.ts`
3. run `npx convex-zen generate`
4. wire the framework adapter to `convex/zen/_generated/meta.ts`
5. mount the framework auth provider and auth route

Generated files in `convex/zen/*` are not hand-edited.

## Key Files

User-authored:

- `convex/zen.config.ts`
- `convex/auth.config.ts`
- framework auth server/client files

Generated:

- `convex/zen/core.ts`
- `convex/zen/plugin/*`
- `convex/zen/_generated/auth.ts`
- `convex/zen/_generated/meta.ts`

## Commands

Install the package in an app:

```bash
pnpm add convex convex-zen
```

Detect project state:

```bash
npx convex-zen doctor
```

Generate Convex wrappers:

```bash
npx convex-zen generate
```

## Workspace

- Library package: `packages/convex-zen`
- Demo apps: `apps/next`, `apps/tanstack`, `apps/expo`
- Public docs source: `apps/docs/external`
- Internal architecture notes: `apps/docs/internal`
- Project background: `PROJECT.md`

## Testing and Build

```bash
pnpm -C packages/convex-zen test
pnpm -C packages/convex-zen build
pnpm -C packages/convex-zen build:dist
pnpm -C apps/next build
pnpm -C apps/tanstack build
```

## License and Attribution

- Repository license: `LICENSE` (Apache License 2.0)
- Required notices: `NOTICE`
- Third-party provenance and notices: `THIRD_PARTY_NOTICES.md`
