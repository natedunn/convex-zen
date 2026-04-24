# Migrate Next.js From Better Auth To convex-zen

Use this guide when:

- the app already uses Next.js App Router
- the app already uses Convex
- auth is currently powered by Better Auth or the Better Auth Convex component

## What to inventory first

- Better Auth route handlers
- Better Auth env vars and OAuth provider secrets
- any schema or adapter files under `convex/`
- all session and current-user reads

## Migration checklist

1. Isolate existing Better Auth wiring and list all files that import `better-auth`, `@convex-dev/better-auth`, or `convex-better-auth`.
2. Create `convex/zen.config.ts`.
3. Replace `convex/auth.config.ts` with the `convex-zen` identity JWT provider.
4. Run `npx convex-zen generate`.
5. Replace framework auth wiring with these canonical files:
   - `apps/next/src/lib/auth-server.ts`
   - `apps/next/src/lib/auth-client.ts`
   - `apps/next/app/auth-provider.tsx`
   - `apps/next/app/layout.tsx`
   - `apps/next/app/api/auth/[...auth]/route.ts`
6. Move protected route checks and current-user reads to `convex-zen`.
7. Remove Better Auth routes and adapters only after the new flow is live.

## Data and session note

This guide does not attempt automatic data conversion from Better Auth tables or sessions.

## Generic fallback

If the existing Better Auth setup is heavily customized, use:

- `apps/docs/external/install/shared/migration-checklist.md`

## Done means

- Better Auth route handling is no longer active
- `convex-zen/next` owns the auth route and session helpers
- the provider wiring in `app/layout.tsx` matches the canonical example
