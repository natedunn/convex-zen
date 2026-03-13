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

In git worktrees, `pnpm -C apps/tanstack dev` will reuse `apps/tanstack/.env.local`
from another checkout of this repo if the current worktree does not have one yet.
If no checkout has been configured, run `pnpm -C apps/tanstack convex:dev` once in
the worktree first.

## Run

```bash
pnpm -C apps/tanstack dev
```

Web app URL (via Portless):

- Main checkout: `http://tanstack.localhost:1355`
- Linked worktrees: `http://<branch>.tanstack.localhost:1355`

If you need dev mode without Portless:

```bash
pnpm -C apps/tanstack dev:direct
```
