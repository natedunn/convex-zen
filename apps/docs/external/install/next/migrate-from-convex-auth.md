# Migrate Next.js From Convex Auth To convex-zen

Use this guide when:

- the app already uses Next.js App Router
- the app already uses Convex
- auth is currently powered by `@convex-dev/auth`

## What stays

- Next.js App Router
- Convex deployment
- most application pages and business logic

## What changes

- `convex/zen.config.ts` becomes the auth config source of truth
- `convex/auth.config.ts` uses `createConvexZenIdentityJwt()`
- Next auth server/client wiring moves to `convex-zen/next`

## Migration checklist

1. Inventory existing Convex Auth routes, auth helpers, and env vars.
2. Create `convex/zen.config.ts`.
3. Replace `convex/auth.config.ts` with the `convex-zen` identity JWT provider.
4. Run `npx convex-zen generate`.
5. Replace framework auth helpers with the canonical Next files:
   - `apps/next/src/lib/auth-server.ts`
   - `apps/next/src/lib/auth-client.ts`
   - `apps/next/app/auth-provider.tsx`
   - `apps/next/app/layout.tsx`
   - `apps/next/app/api/auth/[...auth]/route.ts`
6. Switch protected route checks to the new server helpers.
7. Remove old Convex Auth wiring only after sign-in, sign-out, reset, and current-user reads work.

## Data and session note

This first pass is a code and config migration guide. It does not automate user, account, or session table migration.

## Done means

- no remaining `@convex-dev/auth` runtime wiring is used by the app
- `npx convex-zen generate` succeeds
- the Next auth provider is mounted
- the Next auth route works
