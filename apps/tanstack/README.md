# TanStack playground

This app is the canonical integration reference for `convex-zen/tanstack-start`.

## Canonical integration files

Use these files when writing docs or when an LLM agent needs the exact target shape:

- `apps/tanstack/src/lib/auth-server.ts`
- `apps/tanstack/src/lib/auth-client.ts`
- `apps/tanstack/src/router.tsx`
- `apps/tanstack/src/routes/__root.tsx`
- `apps/tanstack/src/routes/api.auth.$.tsx`

## Setup

1. Copy env template:

```bash
cp apps/tanstack/.env.local.example apps/tanstack/.env.local
```

2. Start Convex in this app:

```bash
pnpm -C apps/tanstack convex:dev
```

3. Set `VITE_CONVEX_URL` in `apps/tanstack/.env.local`.

## Run

```bash
pnpm -C apps/tanstack dev
```

If you need dev mode without Portless:

```bash
pnpm -C apps/tanstack dev:direct
```
