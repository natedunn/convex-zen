# Next.js playground

This app is a local playground for testing `convex-zen/next` client and server helpers.

## Setup

1. Copy env template:

```bash
cp apps/next/.env.local.example apps/next/.env.local
```

2. Start Convex in this app (first run prints your deployment URL):

```bash
pnpm -C apps/next convex:dev
```

3. Set `NEXT_PUBLIC_CONVEX_URL` in `apps/next/.env.local`.
4. Set `CONVEX_SITE_URL` to your app origin (`http://next.convex-zen.localhost:1355` when using Portless).

## Run

```bash
pnpm -C apps/next dev
```

Open `http://next.convex-zen.localhost:1355`.

If you need raw Next dev without Portless:

```bash
pnpm -C apps/next dev:direct
```

## Notes

- `/api/auth/[...auth]` is backed by `createNextAuthServer(...)`.
- Convex functions live in `apps/next/convex`.
- Core auth flow pages:
  - `/signup`
  - `/verify`
  - `/signin`
  - `/reset`
- `/dashboard` is protected with `isAuthenticated` and redirects to `/signin` when unauthenticated.
