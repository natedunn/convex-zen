# 01 - Architecture

## Why this structure

`convex-zen` runs auth inside a Convex component, so unlike Better Auth adapters we do not run a second auth server.

Import distinction baseline:

- https://github.com/get-convex/better-auth
- https://labs.convex.dev/better-auth

Those references keep behavior familiar, but `convex-zen` intentionally implements auth runtime in Convex components instead of importing adapter/server layers from Better Auth integrations.

The integration surface should still feel familiar:

1. Sign in returns a session token.
2. Web adapters can store that token in an HttpOnly cookie.
3. Native adapters can store that token in client storage.
4. Session checks validate the token through Convex public auth functions.

## Layers

### Layer A: Convex component auth core

Already exists in this repo:

- user/session/account data model
- session token issuance and validation
- auth gateway functions

### Layer B: `convex-zen` framework-agnostic primitives

New in this iteration:

- `SessionPrimitives`
- reusable sign-in/session/sign-out orchestration with no framework imports

### Layer C: framework adapters

Current adapters:

- `convex-zen/expo`: direct Convex-function transport, async client storage (`expo-secure-store`, `AsyncStorage`, or equivalent), and manual OAuth callback completion for deep-link flows
- `convex-zen/tanstack-start`: route-backed TanStack Start server functions and cookie management
- `convex-zen/next`: route-backed Next.js handlers and cookie management

Future:

- `convex-zen/sveltekit`

The adapter split is now:

- web adapters: `convex-zen/tanstack-start`, `convex-zen/next`
- native/storage adapters: `convex-zen/expo`

## Why this is replicatable

Apps only provide transport functions (how to call Convex actions).  
Everything else (session orchestration + framework semantics) stays inside the package.
