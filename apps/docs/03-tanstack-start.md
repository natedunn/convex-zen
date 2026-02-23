# 03 - TanStack Start Adapter (`convex-zen/tanstack-start`)

Import distinction baseline:

- https://github.com/get-convex/better-auth
- https://labs.convex.dev/better-auth

This adapter keeps framework ergonomics familiar while sourcing auth behavior from `convex-zen` primitives and Convex component functions, not Better Auth runtime imports.

## What was added

File: `packages/convex-zen/src/client/tanstack-start.ts`

Export:

- `createTanStackStartAuth(options)`
- `createTanStackStartConvexAuth(options)`
- `createTanStackStartAuthApiHandler({ tanstackAuth, basePath? })`
- `createTanStackStartSessionHandlers(tanstackAuth)`
- `createTanStackStartAuthHandlers(tanstackAuth)`
- `createTanStackStartConvexFetchers({ tanstackAuth, convexUrl })`
- `convexZenReactStart(options)`

File: `packages/convex-zen/src/client/tanstack-start-plugins.ts`

Export:

- `adminApiPlugin({ actions, routePrefix? })`

File: `packages/convex-zen/src/client/tanstack-start-client.ts`

Export:

- `createTanStackStartAuthApiClient({ basePath?, credentials?, fetch?, plugins? })`
- `createTanStackStartReactAuthClient({ getSession })` (legacy-compatible wrapper)

File: `packages/convex-zen/src/client/tanstack-start-client-plugins.ts`

Export:

- `adminClient({ routePrefix? })`

This adapter composes:

1. TanStack cookie APIs (`getCookie`, `setCookie`, `deleteCookie`)
2. `SessionPrimitives`
3. Optional Convex action refs helper (`createTanStackStartConvexAuth`)

## Returned handlers

`createTanStackStartAuth(...)` returns:

1. `getSession`
2. `getToken`
3. `signIn`
4. `signOut`
5. `requireSession`
6. `withSession`

Each function is a server-side handler. Wrap them with `createServerFn(...)` in app code.

## Usage (clean surface)

```ts
// src/lib/auth-server.ts
import { convexZenReactStart } from "convex-zen/tanstack-start";
import { adminApiPlugin } from "convex-zen/tanstack-start/plugins";
import { api } from "../convex/_generated/api";

export const {
  handler,
  getSession,
  getToken,
  fetchAuthQuery,
  fetchAuthMutation,
  fetchAuthAction,
} = convexZenReactStart({
  convexUrl: import.meta.env.VITE_CONVEX_URL,
  actions: api.functions,
  cookieName: "cz_session",
  cookieOptions: {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: import.meta.env.PROD,
    maxAge: 60 * 60 * 12,
  },
  plugins: [
    adminApiPlugin({
      actions: {
        listUsers: api.functions.listUsers,
        banUser: api.functions.banUser,
        setRole: api.functions.setRole,
      },
    }),
  ],
});

// actions should expose:
// - signInWithEmail
// - validateSession
// - signOut
```

```ts
// src/lib/auth-client.ts
import { createServerFn } from "@tanstack/react-start";
import { createTanStackStartAuthApiClient } from "convex-zen/tanstack-start-client";
import { adminClient } from "convex-zen/tanstack-start-client/plugins";
import { getSession as getServerSession } from "./auth-server";

export const getSession = createServerFn({ method: "GET" }).handler(async () => {
  return getServerSession();
});

export const authClient = createTanStackStartAuthApiClient({
  plugins: [adminClient()],
});

// available client calls:
// - authClient.signInWithEmail({ email, password })
// - authClient.signIn.email({ email, password }) // better-auth style alias
// - authClient.signOut()
// - authClient.admin.listUsers({ limit: 50 }) // plugin method
```

```ts
// src/routes/api.auth.$.tsx
import { createFileRoute } from "@tanstack/react-router";
import { handler } from "../lib/auth-server";

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => handler(request),
      POST: ({ request }) => handler(request),
    },
  },
});
```

```ts
// Example for protected server functions:
// fetchAuthAction resolves session token from cookie and sets Convex auth automatically.
const listUsers = createServerFn({ method: "POST" })
  .inputValidator((input: { limit?: number }) => input)
  .handler(async ({ data }) => {
    return fetchAuthAction(api.functions.listUsers, {
      limit: data.limit,
    });
  });
```

## Notes

- Current demo wiring lives in route files:
  - `apps/tanstack/src/lib/auth-server.ts` (`convexZenReactStart(...)` single-call setup)
  - `apps/tanstack/src/lib/auth-client.ts` (server-fn wrapper for `getSession` + browser auth client)
  - `apps/tanstack/src/routes/api.auth.$.tsx` (dynamic `/api/auth/$` route transport)
  - `apps/tanstack/src/routes/__root.tsx` (SSR auth `beforeLoad` + provider mount)
  - `apps/tanstack/src/routes/admin.tsx` (loader prefetch + `useQuery` via Convex TanStack helpers)
  - `apps/tanstack/src/router.tsx` (TanStack Query + Convex SSR integration)
- `createServerFn(...)` should be called in app code (route/server files), then delegate to these helpers. This keeps TanStack's server-fn transform working in real projects.
- `createTanStackStartAuthApiClient(...)` removes app-local auth fetch boilerplate while preserving a better-auth-like client surface (`signIn.email`, `signOut`).
- Invalid cookie tokens are cleared automatically on `getSession`.
- `signOut` clears cookie even if backend sign-out fails (best-effort revocation + deterministic logout UX).
- This pattern maps closely to current auth integrations: server function/mutation -> cookie write -> session read via server.

## TanStack Query + SSR setup (current)

The demo now follows Convex's TanStack setup pattern:

1. create `ConvexQueryClient` + `QueryClient`
2. register `queryKeyHashFn` and `queryFn` from `ConvexQueryClient`
3. call `convexQueryClient.connect(queryClient)`
4. wrap router with `routerWithQueryClient(...)`
5. use route loaders with `ensureQueryData(...)` where needed (example: admin route)

`setupRouterSsrQueryIntegration` is intentionally not used because `routerWithQueryClient` already wires SSR dehydration/hydration and query streaming for this stack.

### Admin route query style

For protected admin data in the example app:

1. root `beforeLoad` resolves session via server fn
2. admin loader prefetches with `ensureQueryData(...)`
3. component reads data via `useQuery(...)`

The query/mutation calls use Convex TanStack helpers (`convexAction`, `useConvexMutation`) so route-level fetching style matches Convex docs.
