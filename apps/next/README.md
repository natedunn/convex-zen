# Next.js playground

This app is the canonical integration reference for `convex-zen/next`.

## Canonical integration files

Use these files when writing docs or when an LLM agent needs the exact target shape:

- `apps/next/src/lib/auth-server.ts`
- `apps/next/src/lib/auth-client.ts`
- `apps/next/app/auth-provider.tsx`
- `apps/next/app/layout.tsx`
- `apps/next/app/api/auth/[...auth]/route.ts`

## Setup

1. Copy env template:

```bash
cp apps/next/.env.local.example apps/next/.env.local
```

2. Start Convex in this app:

```bash
pnpm -C apps/next convex:dev
```

3. Set `NEXT_PUBLIC_CONVEX_URL` in `apps/next/.env.local`.
4. Set `CONVEX_SITE_URL` to your app origin.

## Run

```bash
pnpm -C apps/next dev
```

If you need raw Next dev without Portless:

```bash
pnpm -C apps/next dev:direct
```
