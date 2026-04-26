# Generic Auth Migration Checklist

Use this when the app already has an auth solution but it is not clearly Convex Auth or Better Auth.

## Inventory first

- current auth packages
- route handlers
- session helpers
- current-user helpers
- env vars and secrets
- database tables tied to auth

## Replace in this order

1. Add `convex/zen.config.ts`.
2. Add or replace `convex/auth.config.ts`.
3. Run `npx convex-zen generate`.
4. Switch framework auth server/client wiring to the canonical example files for the framework.
5. Switch protected-route checks and current-user reads.
6. Remove old auth routes only after the new flow works.

## Canonical targets

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

## First-pass limitation

This checklist covers code and configuration migration only. It does not automate data migration between auth table layouts.
