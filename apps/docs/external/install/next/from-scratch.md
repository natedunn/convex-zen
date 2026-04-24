# Next.js From Scratch

Use this guide when:

- you do not have a Next.js app yet, or
- you have a Next.js app but Convex is not installed yet

## Outcome

You will finish with:

- Next.js App Router
- Convex installed
- `convex-zen` installed
- Next server/client auth wiring in place

## Commands

Create the app and install Convex using the standard framework flow first, then install `convex-zen`:

```bash
pnpm add convex convex-zen
npx convex-zen doctor
```

If `doctor` reports `existing-framework-no-convex`, install Convex first, then continue with:

- `apps/docs/external/install/next/add-to-existing-convex.md`

## Canonical example files

- `apps/next/src/lib/auth-server.ts`
- `apps/next/src/lib/auth-client.ts`
- `apps/next/app/auth-provider.tsx`
- `apps/next/app/layout.tsx`
- `apps/next/app/api/auth/[...auth]/route.ts`

## Done means

- `convex/convex.config.ts` exists
- `convex/auth.config.ts` exists
- `convex/zen.config.ts` exists
- `npx convex-zen generate` succeeds
- the Next auth provider is mounted in `app/layout.tsx`
- the auth route exists at `app/api/auth/[...auth]/route.ts`
