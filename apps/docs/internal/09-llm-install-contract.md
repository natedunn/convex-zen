# 09 - LLM Install Contract

This is the internal contract that public docs, CLI output, and example apps must preserve.

## Required entrypoints

- `README.md`
- `LLMS.md`
- `npx convex-zen doctor`

## Required install model

- `convex/zen.config.ts` is the only user-authored auth config source of truth
- `convex/auth.config.ts` is required for Convex identity wiring
- `npx convex-zen generate` creates the generated Convex wrappers
- framework adapters read `convex/zen/_generated/meta.ts`

## Required scenario docs

Next.js:

- from scratch
- add to existing Convex app
- migrate from Convex Auth
- migrate from Better Auth

TanStack Start:

- from scratch
- add to existing Convex app
- migrate from Convex Auth
- migrate from Better Auth

## Canonical example references

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

## Required tests

- doctor detection tests for supported project states
- docs contract tests that ensure critical paths and references stay real
