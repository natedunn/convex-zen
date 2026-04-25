# convex-zen LLM Install Contract

Use this file when an LLM agent needs to install or migrate `convex-zen` in one pass.

## Supported Frameworks

- Next.js App Router
- TanStack Start

## First Steps

1. Run `npx convex-zen doctor`.
2. Read the scenario doc that `doctor` recommends.
3. Use the canonical example app for the matching framework.

## Source Of Truth

User-authored files:

- `convex/zen.config.ts`
- `convex/auth.config.ts`

Generated files:

- `convex/zen/core.ts`
- `convex/zen/plugin/*`
- `convex/zen/_generated/auth.ts`
- `convex/zen/_generated/meta.ts`

Never hand-edit generated files in `convex/zen/*`.

## Canonical Example Files

Next.js:

- `apps/next/src/lib/auth-server.ts`
- `apps/next/src/lib/auth-client.ts`
- `apps/next/app/auth-provider.tsx`
- `apps/next/app/layout.tsx`
- `apps/next/app/api/auth/[...auth]/route.ts`

TanStack Start:

- `apps/tanstack/src/lib/auth-server.ts`
- `apps/tanstack/src/lib/auth-client.ts`
- `apps/tanstack/src/router.tsx`
- `apps/tanstack/src/routes/__root.tsx`
- `apps/tanstack/src/routes/api/auth/$.tsx`

## State Matrix

- `existing-framework-no-convex`
  Use the framework `from-scratch.md` guide, starting from the Convex install step.
- `existing-framework-with-convex-no-auth`
  Use `add-to-existing-convex.md`.
- `existing-framework-with-convex-auth`
  Use `migrate-from-convex-auth.md`.
- `existing-framework-with-better-auth`
  Use `migrate-from-better-auth.md`.
- `existing-framework-with-other-auth`
  Use `apps/docs/external/install/shared/migration-checklist.md` first, then the framework add guide.

## Minimal Successful Install

The default one-shot target is email/password only:

1. create `convex/zen.config.ts`
2. create `convex/auth.config.ts`
3. run `npx convex-zen generate`
4. wire framework auth server/client files
5. mount provider and route handler
6. run `pnpm exec convex dev`

Add OAuth and plugins only after the baseline flow works.
