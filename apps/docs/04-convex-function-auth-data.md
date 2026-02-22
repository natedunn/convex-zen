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

## Recommended function pattern

Use explicit helper functions in your host app (or package adapters) so every protected action follows the same flow:

1. read token
2. validate token
3. throw `Unauthorized` when absent/invalid
4. continue with `session.userId`

## Example host action shape

```ts
export const myProtectedAction = action({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const session = await auth.validateSession(ctx, args.token);
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
