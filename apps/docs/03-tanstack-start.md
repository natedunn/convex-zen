# 03 - TanStack Start Adapter (`convex-zen/tanstack-start`)

Import distinction baseline:

- https://github.com/get-convex/better-auth
- https://labs.convex.dev/better-auth

This adapter keeps framework ergonomics familiar while sourcing auth behavior from `convex-zen` primitives and Convex component functions, not Better Auth runtime imports.

## What was added

File: `packages/convex-zen/src/client/tanstack-start.ts`

Export:

- `createTanStackStartAuth(options)`

This adapter composes:

1. TanStack Start server functions (`createServerFn`)
2. TanStack cookie APIs (`getCookie`, `setCookie`, `deleteCookie`)
3. `SessionPrimitives`

## Returned server functions

`createTanStackStartAuth(...)` returns:

1. `getSession`
2. `signIn`
3. `signOut`

Each function is already a TanStack Start server function.

## Usage

```ts
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { createSessionPrimitives } from "convex-zen";
import { createTanStackStartAuth } from "convex-zen/tanstack-start";

const convex = new ConvexHttpClient(process.env.VITE_CONVEX_URL!);

const primitives = createSessionPrimitives({
  signIn: (input) => convex.action(api.functions.signIn, input),
  validateSession: (token) => convex.action(api.functions.validateSession, { token }),
  signOut: (token) => convex.action(api.functions.signOut, { token }),
});

export const tanstackAuth = createTanStackStartAuth({
  primitives,
  cookieName: "cz_session",
  cookieOptions: {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 12,
  },
});

export const getSession = tanstackAuth.getSession;
export const signIn = tanstackAuth.signIn;
export const signOut = tanstackAuth.signOut;
```

## Notes

- Invalid cookie tokens are cleared automatically on `getSession`.
- `signOut` clears cookie even if backend sign-out fails (best-effort revocation + deterministic logout UX).
- This pattern maps closely to current auth integrations: server function/mutation -> cookie write -> session read via server.
