# 03 - TanStack Start Adapter (`convex-zen/tanstack-start`)

## What changed

File: `packages/convex-zen/src/client/tanstack-start.ts`

- `createTanStackAuthServer(options)`
- `createTanStackStartAuth(options)`
- `createTanStackStartConvexAuth(options)`
- `createTanStackStartAuthApiHandler(options)`
- `createTanStackStartConvexFetchers(options)`

File: `packages/convex-zen/src/client/tanstack-start-client.ts`

- `createTanStackAuthClient(options)`
- `createTanStackStartReactAuthClient(serverFns)`

File: `packages/convex-zen/src/client/tanstack-start-plugins.ts`

- `pluginApiPlugin({ pluginMeta, routePrefix? })`
- `adminApiPlugin({ convexFunctions?, routePrefix? })` (explicit/manual plugin)

File: `packages/convex-zen/src/client/tanstack-start-plugin-meta.ts`

- `TanStackAuthPluginMeta`

## Auto plugin model

`plugins` defaults to `"auto"` on both server and client.

Auto plugin routes use:

1. `convexFunctions: api.auth`
2. generated `authPluginMeta` from `convex/auth/plugin/metaGenerated.ts`

Route shape:

- `POST /api/auth/plugin/<plugin-name>/<function-name>`
- Example: `plugin.admin.listUsers` -> `/api/auth/plugin/admin/list-users`

Client shape:

- `authClient.plugin.<pluginName>.<functionName>(args)`
- Example: `authClient.plugin.admin.listUsers({ limit: 50 })`

## App usage

```ts
// src/lib/auth-server.ts
import { createTanStackAuthServer } from "convex-zen/tanstack-start";
import { api } from "../../convex/_generated/api";
import { authPluginMeta } from "../../convex/auth/plugin/metaGenerated";

export const {
  handler,
  getSession,
  fetchAuthQuery,
  fetchAuthMutation,
  fetchAuthAction,
} = createTanStackAuthServer({
  convexUrl: import.meta.env.VITE_CONVEX_URL,
  convexFunctions: api.auth,
  pluginMeta: authPluginMeta,
});
```

```ts
// src/lib/auth-client.ts
import { createTanStackAuthClient } from "convex-zen/tanstack-start-client";
import { api } from "../../convex/_generated/api";
import { authPluginMeta } from "../../convex/auth/plugin/metaGenerated";

export const authClient = createTanStackAuthClient({
  convexFunctions: api.auth,
  pluginMeta: authPluginMeta,
});
```

## Notes

- Plugin route transport is POST-only.
- Auth and permissions are still enforced inside Convex functions.
- `plugins: []` disables auto route/client plugin inference.
