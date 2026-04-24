# Migrate TanStack Start From Better Auth To convex-zen

Use this guide when:

- the app already uses TanStack Start
- the app already uses Convex
- auth is currently powered by Better Auth or the Better Auth Convex component

## What to inventory first

- Better Auth route handlers
- Better Auth adapter files under `convex/`
- current session and current-user reads
- env vars and OAuth provider secrets

## Migration checklist

1. Identify every file that imports `better-auth`, `@convex-dev/better-auth`, or `convex-better-auth`.
2. Create `convex/zen.config.ts`.
3. Replace `convex/auth.config.ts` with the `convex-zen` identity JWT provider.
4. Run `npx convex-zen generate`.
5. Replace framework wiring with the canonical TanStack files:
   - `apps/tanstack/src/lib/auth-server.ts`
   - `apps/tanstack/src/lib/auth-client.ts`
   - `apps/tanstack/src/router.tsx`
   - `apps/tanstack/src/routes/__root.tsx`
   - `apps/tanstack/src/routes/api.auth.$.tsx`
6. Move protected-route and current-user reads to `convex-zen`.
7. Remove Better Auth handlers only after the new flow is live.

## Data and session note

This guide does not automate Better Auth table or session conversion.

## Generic fallback

If the existing Better Auth setup is highly customized, start with:

- `apps/docs/external/install/shared/migration-checklist.md`

## Done means

- Better Auth route handling is no longer active
- route-backed auth now flows through the canonical TanStack files
- `src/router.tsx` and `src/routes/__root.tsx` match the canonical integration shape
