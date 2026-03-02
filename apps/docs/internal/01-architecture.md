# 01 - Architecture

## Why this structure

`convex-zen` runs auth inside a Convex component, so unlike Better Auth adapters we do not run a second auth server.

Import distinction baseline:

- https://github.com/get-convex/better-auth
- https://labs.convex.dev/better-auth

Those references keep behavior familiar, but `convex-zen` intentionally implements auth runtime in Convex components instead of importing adapter/server layers from Better Auth integrations.

The integration surface should still feel familiar:

1. Sign in returns a session token.
2. Framework layer stores that token in an HttpOnly cookie.
3. Session checks read cookie token and validate it server-side.
4. App/client reads session state from framework server functions.

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

New in this iteration:

- `convex-zen/tanstack-start`
- wraps primitives with TanStack Start server functions and cookie management

Future:

- `convex-zen/next`
- `convex-zen/sveltekit`
- `convex-zen/expo` (client storage oriented)

## Why this is replicatable

Apps only provide transport functions (how to call Convex actions).  
Everything else (session orchestration + framework semantics) stays inside the package.
