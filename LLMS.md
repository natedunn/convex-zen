# convex-zen LLM Install Contract

Use this file when an LLM agent needs to install or migrate `convex-zen` in one pass.

## Supported Frameworks

- Next.js App Router
- TanStack Start

## First Steps

1. Run `npx convex-zen doctor`.
2. Read the scenario doc that `doctor` recommends.
3. Use the canonical example app for the matching framework.

## Source Of Truth

User-authored files:

- `convex/zen.config.ts`
- `convex/auth.config.ts`

Generated files:

- `convex/zen/core.ts`
- `convex/zen/plugin/*`
- `convex/zen/_generated/auth.ts`
- `convex/zen/_generated/meta.ts`

Never hand-edit generated files in `convex/zen/*`.

## Canonical Example Files

Next.js:

- `apps/next/src/lib/auth-server.ts`
- `apps/next/src/lib/auth-client.ts`
- `apps/next/app/auth-provider.tsx`
- `apps/next/app/layout.tsx`
- `apps/next/app/api/auth/[...auth]/route.ts`

TanStack Start:

- `apps/tanstack/src/lib/auth-server.ts`
- `apps/tanstack/src/lib/auth-client.ts`
- `apps/tanstack/src/router.tsx`
- `apps/tanstack/src/routes/__root.tsx`
- `apps/tanstack/src/routes/api/auth/$.tsx`

## State Matrix

- `existing-framework-no-convex`
  Use the framework `from-scratch.md` guide, starting from the Convex install step.
- `existing-framework-with-convex-no-auth`
  Use `add-to-existing-convex.md`.
- `existing-framework-with-convex-auth`
  Use `migrate-from-convex-auth.md`.
- `existing-framework-with-better-auth`
  Use `migrate-from-better-auth.md`.
- `existing-framework-with-other-auth`
  Use `apps/docs/external/install/shared/migration-checklist.md` first, then the framework add guide.

## Minimal Successful Install

For a baseline install with no explicit OAuth request:

1. create `convex/zen.config.ts`
2. create `convex/auth.config.ts`
3. run `npx convex-zen generate`
4. wire framework auth server/client files
5. mount provider and route handler
6. run `pnpm exec convex dev`

## OAuth One-Shot Rules

If the user asks for OAuth during setup, include it in the same pass instead of deferring it.

Required OAuth work:

1. add provider config in `convex/zen.config.ts`
2. set provider secrets in Convex env
3. run `npx convex-zen generate`
4. wire the framework auth server/client files
5. include the correct callback URL registration instructions

Use these shared docs as the source of truth:

- `apps/docs/external/oauth.md`
- `apps/docs/external/oauth-proxy.md`
- `apps/docs/external/expo-installation.md`

## Direct vs Proxy OAuth

Use direct OAuth by default when every app origin can be registered in the provider console.

Use proxy mode when the request mentions any of these:

- one callback URL or one redirect URI
- preview URLs
- a stable auth host such as `auth.example.com`
- Expo/native callback handoff through a web broker
- "oauth proxy", "broker mode", or similar wording

Proxy mode role split:

- Broker or hybrid apps must add `oauthProxy.allowedReturnTargets` to `convex/zen.config.ts`
- Next.js and TanStack Start broker or hybrid server adapters must set `oauthProxy: true`
- Consumer or hybrid web apps must set `CONVEX_ZEN_PROXY_BROKER`
- Expo consumers must set `oauthProxy.brokerOrigin` and finish `oauth_proxy_code` with `completeOAuthProxy(...)`
- Provider consoles must register the broker callback URL such as `https://auth.example.com/api/auth/callback/google`

Direct mode callback URLs use the app origin:

- `${APP_ORIGIN}/api/auth/callback/google`
- `${APP_ORIGIN}/api/auth/callback/github`
- `${APP_ORIGIN}/api/auth/callback/discord`
