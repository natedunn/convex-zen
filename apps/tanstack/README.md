# TanStack playground

This app is a local playground for testing `convex-zen/tanstack-start`.

## Setup

1. Copy env template:

```bash
cp apps/tanstack/.env.local.example apps/tanstack/.env.local
```

2. Start Convex in this app (first run prints your deployment URL):

```bash
pnpm -C apps/tanstack convex:dev
```

3. Set `VITE_CONVEX_URL` in `apps/tanstack/.env.local`.

## Run

```bash
pnpm -C apps/tanstack dev
```

Web app URL (via Portless):

- `http://tanstack.convex-zen.localhost:1355`

If you need dev mode without Portless:

```bash
pnpm -C apps/tanstack dev:direct
```
