# Migrate TanStack Start From Convex Auth To convex-zen

Use this guide when:

- the app already uses TanStack Start
- the app already uses Convex
- auth is currently powered by `@convex-dev/auth`

## Migration checklist

1. Inventory current Convex Auth routes, providers, and client helpers.
2. Create `convex/zen.config.ts`.
3. Replace `convex/auth.config.ts` with `createConvexZenIdentityJwt()`.
4. Run `npx convex-zen generate`.
5. Replace framework auth wiring with the canonical TanStack files:
   - `apps/tanstack/src/lib/auth-server.ts`
   - `apps/tanstack/src/lib/auth-client.ts`
   - `apps/tanstack/src/router.tsx`
   - `apps/tanstack/src/routes/__root.tsx`
   - `apps/tanstack/src/routes/api/auth/$.tsx`
6. Switch protected route and current-user reads to the new helpers.
7. Remove old Convex Auth wiring only after the new flow is verified.

## Data and session note

This guide does not automate user, account, or session migration.

## Done means

- no active `@convex-dev/auth` route or client wiring remains
- `npx convex-zen generate` succeeds
- `src/router.tsx` and `src/routes/__root.tsx` match the canonical integration shape
