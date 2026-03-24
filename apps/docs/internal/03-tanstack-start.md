# 03 - TanStack Start Adapter (`convex-zen/tanstack-start`)

## What changed

File: `packages/convex-zen/src/client/tanstack-start.ts`

- `createTanStackAuthServer(options)`
- `createTanStackStartAuthApiHandler(options)`
- `createTanStackStartConvexFetchers(options)`

File: `packages/convex-zen/src/client/tanstack-start-client.ts`

- `createTanStackAuthClient(options)`
- `createTanStackAuthClient(options)` (includes dependency-free query/mutation/action helpers on plugin + core methods)
- `authClient.getToken()`, `authClient.clearToken()`, `authClient.connectConvexAuth(...)`

File: `packages/convex-zen/src/client/tanstack-start-plugins.ts`

- `pluginApiPlugin({ pluginMeta, routePrefix? })`
- `systemAdminApiPlugin({ convexFunctions?, routePrefix? })` (explicit/manual plugin)

File: `packages/convex-zen/src/client/tanstack-start-plugin-meta.ts`

- `TanStackAuthPluginMeta`

## Auto plugin model

`plugins` defaults to `"auto"` on both server and client.

Auto plugin routes use:

1. `convexFunctions: api.zen`
2. generated `authMeta` from `convex/zen/_generated/meta.ts`

Route shape:

- `POST /api/auth/plugin/<plugin-name>/<function-name>`
- Example: `plugin.systemAdmin.listUsers` -> `/api/auth/plugin/system-admin/list-users`

Client shape:

- `authClient.plugin.<pluginName>.<functionName>(args)`
- Example: `authClient.plugin.systemAdmin.listUsers({ limit: 50 })`
- `authClient.core.<functionName>(args)` (auto-inferred from `api.zen.core.*`)
- Example: `authClient.core.signUp({ email, password })`
- non-conflicting core methods are also auto-aliased at root (for example `authClient.signUp(...)`)
- conflicts throw with a descriptive error (reserved root keys include: `getSession`, `getToken`, `clearToken`, `connectConvexAuth`, `signIn`, `signOut`, `plugin`, `core`)

## App usage

```ts
// src/lib/auth-server.ts
import { createTanStackAuthServer } from "convex-zen/tanstack-start";
import { api } from "../../convex/_generated/api";
import { authMeta } from "../../convex/zen/_generated/meta";

export const {
  handler,
  getSession,
  fetchAuthQuery,
  fetchAuthMutation,
  fetchAuthAction,
} = createTanStackAuthServer({
  convexUrl: import.meta.env.VITE_CONVEX_URL,
  convexFunctions: api.zen,
  meta: authMeta,
});
```

```ts
// src/lib/auth-client.ts
import { createTanStackAuthClient } from "convex-zen/tanstack-start";
import { api } from "../../convex/_generated/api";
import { authMeta } from "../../convex/zen/_generated/meta";

export const authClient = createTanStackAuthClient({
  convexFunctions: api.zen,
  meta: authMeta,
});
```

```ts
// Optional: runtime-first setup (recommended for direct convexQuery usage)
export const authClient = createTanStackAuthClient({
  convexFunctions: api.zen,
  meta: authMeta,
  runtime: {
    // default memory cache; set to "localStorage" only if you accept XSS tradeoffs
    storage: "memory",
    // built-in cross-tab invalidation/sign-in/sign-out sync
    sync: "broadcast",
    refreshSkewMs: 30_000,
    maxUnauthorizedRefreshRetries: 1,
  },
});
```

```ts
// Optional: bridge direct Convex auth for convexQuery(...) usage
import { ConvexReactClient } from "convex/react";
import { authClient } from "./auth-client";

export const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL);
export const disconnectConvexAuth = authClient.connectConvexAuth(convex);
```

## Auth runtime modes

Use one of these patterns per app/page.

### 1) Route-backed only (default)

- Keep using `authClient.getSession()`, `authClient.signIn.email(...)`, `authClient.signOut()`.
- Use route-backed plugin/core methods (for example `authClient.plugin.systemAdmin.listUsers(args)`).
- Do not connect Convex direct auth bridge.

### 2) Hybrid (recommended for TanStack Query apps)

- Keep route-backed session/sign-in/sign-out.
- Also connect direct Convex bridge once in router setup:

```ts
// src/router.tsx
import { ConvexReactClient } from "convex/react";
import { authClient } from "./auth-client";

export const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL);
authClient.connectConvexAuth(convex);
```

- Route-backed helpers:
  - `useQuery(authClient.currentUser.query())`
  - `useQuery(authClient.plugin.systemAdmin.listUsers.query({ limit: 10 }))`
- Direct Convex query factories (when desired):
  - `useQuery(convexQuery(api.zen.core.currentUser, {}))`
  - `useQuery(convexQuery(api.zen.plugin.systemAdmin.listUsers, { limit: 10 }))`

### 3) Direct-mode emphasis

- Keep `/api/auth/*` enabled for cookie/session/token issuance.
- Read auth state via direct Convex calls after connecting bridge.
- Session transport is still cookie-backed; bridge only supplies Convex bearer tokens.

## SSR direct queries (TanStack Start)

For server-side direct Convex calls, fetch the token from auth server helpers and set auth on a server Convex client.

```ts
import { createServerFn } from "@tanstack/react-start";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";

const getCurrentUserServerFn = createServerFn({ method: "GET" }).handler(
  async () => {
    const { getToken } = await import("../lib/auth-server");
    const token = await getToken();
    if (!token) {
      return null;
    }
    const convex = new ConvexHttpClient(import.meta.env.VITE_CONVEX_URL);
    convex.setAuth(token);
    return convex.query(api.zen.core.currentUser, {});
  }
);
```

`createTanStackAuthServer(...)` also exposes `fetchAuthQuery/fetchAuthMutation/fetchAuthAction`,
which is the easiest authenticated SSR path when you do not need manual client setup.

## Query helper primitives (dependency-free)

`createTanStackAuthClient(...)` keeps route-backed auth (`getSession`, `signIn`, `signOut`)
and augments plugin/core methods with framework-agnostic query/mutation/action helpers.

Core wrappers from `api.zen.core.*` are also auto-exposed as route methods at
`authClient.core.*` and routed through `POST /api/auth/core/<function-name>`.
Generated session invalidation wrapper is `core.invalidateSession(...)`; built-in
client sign-out remains `authClient.signOut()`.
Core helpers are auto-attached for generated core function names. If you add custom
core wrappers, pass `coreMeta` to `createTanStackAuthClient(...)` for helper
kind mapping.
Root-mirrored core methods share those helpers too (for example `authClient.signUp.mutate(...)`).

- Query plugin/core methods:
  - `.query(args)` / `.queryOptions(args)`
  - `.suspenseQuery(args)`
  - `.prefetchQuery(queryClientLike, args)`
  - `.ensureQueryData(queryClientLike, args)`
- Mutation plugin/core methods:
  - `.mutationFn()`
  - `.mutate(args)`
  - optional override forms: `.mutationFn(convexExecutor)` / `.mutate(convexExecutor, args)`
- Action plugin/core methods:
  - `.query(args)` / `.queryOptions(args)` / `.suspenseQuery(args)`
  - `.actionFn()`
  - `.runAction(args)`
  - optional override forms: `.actionFn(convexExecutor)` / `.runAction(convexExecutor, args)`

Important: `.query(...)` returns query options (a plain object), not `{ data, status }`.
Use your framework query hook with those options.
Auth query helpers include a route-backed `queryFn` by default and use
`convexAuthQuery` keys, so they do not get overridden by `ConvexQueryClient`
subscriptions for `convexQuery(...)`.

For authenticated current-user reads in HttpOnly-cookie mode, prefer:
- `useQuery(authClient.currentUser.query())`

Direct Convex query options (for example `convexQuery(api.zen.core.currentUser, {})`)
run unauthenticated by default unless you connect a Convex client token bridge
with `authClient.connectConvexAuth(convexClient)`.
`authClient.currentUser.query()` uses a dedicated query key prefix (`convexAuthQuery`)
so it is not overridden by `ConvexQueryClient` subscriptions for `convexQuery(...)`.

```ts
import { useQuery } from "@tanstack/react-query";

const usersQuery = useQuery(
  authClient.plugin.systemAdmin.listUsers.query({ limit: 10 })
);

const users = usersQuery.data?.users;
```

No `@tanstack/react-query` dependency is required by `convex-zen` core for these helpers.
If you use `@convex-dev/react-query`, note that the package exposes `convexQuery` and `convexAction` options factories and hook-style mutation/action executors (not a `convexMutation` options factory).

## Multi-tab token sync (optional)

By default, each tab keeps token cache in memory and does not sync with other tabs.
To opt in, enable `tokenSync` on the auth client:

```ts
export const authClient = createTanStackAuthClient({
  convexFunctions: api.zen,
  meta: authMeta,
  tokenSync: {
    enabled: true,
    channelName: "convex-zen-auth",
  },
});
```

This uses `BroadcastChannel` events (`signIn`, `signOut`, invalidation, clear) to force
token cache refresh and reconnect Convex auth callbacks across tabs.
No token values are broadcast.

## Security notes

1. Default token storage is memory-only.
2. No `localStorage`/`sessionStorage` token persistence is enabled by default.
3. Keep HttpOnly cookies as the source of truth for session.
4. Route-backed auth remains the safest default; direct mode is opt-in.
5. After repeated direct auth failures, client bridge falls back to unauthenticated (`null`) until re-auth/sign-in.

## Notes

- Plugin route transport is POST-only.
- Auth and permissions are still enforced inside Convex functions.
- `plugins: []` disables auto route/client plugin inference.
