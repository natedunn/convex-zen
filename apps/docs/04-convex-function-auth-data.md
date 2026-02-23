# 04 - Auth Data on Convex Functions Side

Import distinction baseline:

- https://github.com/get-convex/better-auth
- https://labs.convex.dev/better-auth

The goal is compatible mental models with those integrations, but with auth enforcement implemented directly in Convex component functions.

## Constraint to keep in mind

Convex components do not get `ctx.auth` directly.

So the host app must pass identity/session context explicitly, usually by:

1. reading a session token from framework cookie/storage
2. validating with a `validateSession` action
3. passing `userId`/`sessionId` to internal business logic when needed

This is already consistent with `convex-zen` gateway behavior.

In the TanStack demo, this now happens in server functions:

- shared auth setup and helpers in `apps/tanstack/src/lib/auth-server.ts`
  - `handler` for `/api/auth/session`, `/api/auth/sign-in-with-email`, `/api/auth/sign-out`
  - `getSession/getToken` for server-side auth state
  - `fetchAuthQuery/fetchAuthMutation/fetchAuthAction` for token/session-aware Convex calls
  - plugin routes can be mounted with `plugins: [...]` (example: `adminApiPlugin(...)`)
- `getSession` server function wrapper + browser `authClient` in `apps/tanstack/src/lib/auth-client.ts`
- dynamic auth transport in `apps/tanstack/src/routes/api.auth.$.tsx` via `apps/tanstack/src/lib/auth-server.ts`
- root route consumes `getSession` + `authClient` in `apps/tanstack/src/routes/__root.tsx`
- protected Convex calls use `api.functions.*` directly in routes; backend resolution happens via `auth` helpers

Important contract detail:

- admin gateway functions expect `adminToken` (not `token`) on component calls
- if component contracts change, regenerate bindings (`convex codegen`) so host app validators and runtime stay in sync

## `components.convexAuth.gateway` means

`components.convexAuth` is the installed Convex component instance.

`gateway` is the public bridge module exported by the component (`packages/convex-zen/src/component/gateway.ts`).

The host app can call only these exposed gateway functions through `ctx.runAction`/`ctx.runQuery`.
Internal component modules (`core/*`, `providers/*`, `plugins/*`) stay private.

## App-side helper surface

The demo now centralizes app-side auth system helpers in:

- `apps/tanstack/convex/auth.ts`

The `auth` object itself exposes organized chains:

- `auth.session.validate/require`
- `auth.user.safeGet/require`
- `auth.admin.listUsers/banUser/setRole`

This keeps `functions.ts` thin and lets app functions resolve current user through `auth.user.safeGet(ctx)` instead of direct gateway calls in each function handler.

Example:

```ts
const authUser = await auth.safeGetAuthUser(ctx);
if (!authUser) throw new Error("Unauthorized");
```

## Recommended function pattern

Use explicit helper functions in your host app (or package adapters) so every protected action follows the same flow:

1. resolve auth from `ctx` (or token when provided)
2. validate token
3. throw `Unauthorized` when absent/invalid
4. continue with `session.userId`

## Example host action shape

```ts
export const myProtectedAction = action({
  args: { token: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const session = await auth.session.validate(ctx, args.token);
    if (!session) throw new Error("Unauthorized");

    // session.userId available here
    return await doSomethingForUser(ctx, session.userId);
  },
});
```

## Why this stays familiar

This mirrors the mental model from other modern auth stacks:

- auth state is represented by a bearer-like session token
- frameworks own cookie/session transport mechanics
- backend functions authorize via a shared `validateSession`/`requireSession` pattern

The difference is only deployment topology: auth logic is inside Convex component functions, not a separate auth server.
