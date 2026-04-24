# 02 - Core Primitives (`convex-zen`)

Positioning:

- Better Auth Convex component: https://github.com/get-convex/better-auth
- Convex Auth: https://labs.convex.dev/auth

This primitives layer reflects the `convex-zen` package-first model for Convex auth.

## What was added

File: `packages/convex-zen/src/client/primitives.ts`

Exports:

- `SessionPrimitives`
- `createSessionPrimitives(...)`
- types:
  - `SessionTransport`
  - `SessionInfo`
  - `SignInInput`
  - `SignInOutput`
  - `EstablishedSession`

## Concept

`SessionPrimitives` is the package-level orchestration layer.

It does not know anything about TanStack Start, Next.js, cookies, localStorage, etc.
It only knows how to call three transport operations:

1. `signIn(input)` -> `{ sessionToken, userId }`
2. `validateSession(token)` -> session or `null`
3. `signOut(token)` -> void

## Typical usage

```ts
import { createSessionPrimitives, type SessionTransport } from "convex-zen";

const transport: SessionTransport = {
  signIn: async (input) => {
    // call your Convex signIn action
    return { sessionToken: "...", userId: "..." };
  },
  validateSession: async (token) => {
    // call your Convex validateSession action
    return { userId: "...", sessionId: "..." };
  },
  signOut: async (token) => {
    // call your Convex invalidateSession mutation
  },
};

const auth = createSessionPrimitives(transport);

const established = await auth.signInAndResolveSession({
  email: "user@example.com",
  password: "Password123!",
});
// established.sessionToken -> store in framework cookie/storage
// established.session -> immediate session payload
```

## Behavior guarantees

- Missing token resolves to `null` session.
- `requireSessionFromToken` throws `Unauthorized` on invalid/missing token.
- `signInAndResolveSession` verifies newly issued tokens and throws if session cannot be validated.
