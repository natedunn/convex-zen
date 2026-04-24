# Next.js Convex Auth Reference

This directory is the Convex side of the canonical `convex-zen/next` example.

## Source of truth files

- `apps/next/convex/zen.config.ts`
- `apps/next/convex/auth.config.ts`
- `apps/next/convex/convex.config.ts`
- `apps/next/convex/http.ts`

## Generated files

Everything under `apps/next/convex/zen/` is generated or derived from `convex/zen.config.ts`.

Do not hand-edit generated files in:

- `apps/next/convex/zen/_generated`
- `apps/next/convex/zen/core.ts`
- `apps/next/convex/zen/plugin/*`

## For docs and agents

When documenting installation or migration, pair this directory with:

- `apps/next/src/lib/auth-server.ts`
- `apps/next/src/lib/auth-client.ts`
- `apps/next/app/auth-provider.tsx`
- `apps/next/app/layout.tsx`
- `apps/next/app/api/auth/[...auth]/route.ts`
