# TanStack Start Convex Auth Reference

This directory is the Convex side of the canonical `convex-zen/tanstack-start` example.

## Source of truth files

- `apps/tanstack/convex/zen.config.ts`
- `apps/tanstack/convex/auth.config.ts`
- `apps/tanstack/convex/convex.config.ts`
- `apps/tanstack/convex/http.ts`

## Generated files

Everything under `apps/tanstack/convex/zen/` is generated or derived from `convex/zen.config.ts`.

Do not hand-edit generated files in:

- `apps/tanstack/convex/zen/_generated`
- `apps/tanstack/convex/zen/core.ts`
- `apps/tanstack/convex/zen/plugin/*`

## For docs and agents

When documenting installation or migration, pair this directory with:

- `apps/tanstack/src/lib/auth-server.ts`
- `apps/tanstack/src/lib/auth-client.ts`
- `apps/tanstack/src/router.tsx`
- `apps/tanstack/src/routes/__root.tsx`
- `apps/tanstack/src/routes/api.auth.$.tsx`
