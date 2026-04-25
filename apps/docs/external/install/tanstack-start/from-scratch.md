# TanStack Start From Scratch

Use this guide when:

- you do not have a TanStack Start app yet, or
- you have a TanStack Start app but Convex is not installed yet

## Outcome

You will finish with:

- TanStack Start
- Convex installed
- `convex-zen` installed
- route-backed auth and provider wiring in place

## Commands

Install Convex and `convex-zen`, then run:

```bash
pnpm add convex convex-zen @convex-dev/react-query @tanstack/react-query
npx convex-zen doctor
```

If `doctor` reports `existing-framework-no-convex`, install Convex first, then continue with:

- `apps/docs/external/install/tanstack-start/add-to-existing-convex.md`

## Canonical example files

- `apps/tanstack/src/lib/auth-server.ts`
- `apps/tanstack/src/lib/auth-client.ts`
- `apps/tanstack/src/router.tsx`
- `apps/tanstack/src/routes/__root.tsx`
- `apps/tanstack/src/routes/api/auth/$.tsx`

## Done means

- `convex/convex.config.ts` exists
- `convex/auth.config.ts` exists
- `convex/zen.config.ts` exists
- `npx convex-zen generate` succeeds
- `src/router.tsx` connects Convex auth
- `src/routes/__root.tsx` mounts `ConvexZenAuthProvider`
