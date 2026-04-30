# TanStack playground

This app is the canonical integration reference for `convex-zen/tanstack-start`.

## Canonical integration files

Use these files when writing docs or when an LLM agent needs the exact target shape:

- `apps/tanstack/src/lib/auth-server.ts`
- `apps/tanstack/src/lib/auth-client.ts`
- `apps/tanstack/src/router.tsx`
- `apps/tanstack/src/routes/__root.tsx`
- `apps/tanstack/src/routes/api/auth/$.tsx`

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

## Testing OAuth broker mode locally

This example can also run in hybrid OAuth proxy mode.

Use these env values in `apps/tanstack/.env.local`:

```bash
CONVEX_ZEN_PROXY_BROKER=http://auth.localhost:1355
```

Then:

1. Start the app with `pnpm -C apps/tanstack dev`.
2. Open the consumer app at `http://tanstack.localhost:1355/signin`.
3. Start OAuth from that page.
4. Register the provider callback against the broker host, for example `http://auth.localhost:1355/api/auth/callback/google`.

What this exercises:

- consumer sign-in starts on `tanstack.localhost`
- broker callback completes on `auth.localhost`
- the one-time proxy code returns to `tanstack.localhost/api/auth/proxy/exchange`
- the final session cookie is set on the consumer host

The consumer allowlist for this example lives in `apps/tanstack/convex/zen.config.ts`.
