# Next.js Advanced Server Patterns (Convex Zen)

This page covers advanced server-side patterns for `convex-zen/next` in Next App Router apps.

## 1. Auth server setup with explicit plugin control

By default, `createNextAuthServer(...)` uses `plugins: "auto"` and wires core/plugin API routes from generated metadata.

```ts
import { createNextAuthServer } from "convex-zen/next";
import { api } from "../../convex/_generated/api";
import { authMeta } from "../../convex/zen/_generated/meta";

export const authServer = createNextAuthServer({
  convexUrl: process.env.NEXT_PUBLIC_CONVEX_URL as string,
  convexFunctions: api.zen,
  meta: authMeta,
});
```

To disable generated core/plugin API routes entirely:

```ts
export const authServer = createNextAuthServer({
  convexUrl: process.env.NEXT_PUBLIC_CONVEX_URL as string,
  convexFunctions: api.zen,
  meta: authMeta,
  plugins: [],
});
```

To provide custom plugin factories:

```ts
import {
  coreApiPlugin,
  pluginApiPlugin,
  createNextAuthServer,
} from "convex-zen/next";

export const authServer = createNextAuthServer({
  convexUrl: process.env.NEXT_PUBLIC_CONVEX_URL as string,
  convexFunctions: api.zen,
  meta: authMeta,
  plugins: [
    coreApiPlugin({ coreMeta: authMeta.core }),
    pluginApiPlugin({ pluginMeta: authMeta.plugin }),
    {
      create: () => ({
        id: "custom",
        handle: async (context) => {
          if (context.method !== "POST" || context.action !== "custom/ping") {
            return null;
          }
          return context.json({ ok: true });
        },
      }),
    },
  ],
});
```

## 2. Protected pages: `isAuthenticated` vs `requireSession`

Simple redirect check:

```tsx
import { isAuthenticated } from "@/lib/auth-server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  if (!(await isAuthenticated("/dashboard"))) {
    redirect("/");
  }
  return <h1>Dashboard</h1>;
}
```

If you need full session data and token:

```tsx
import { headers } from "next/headers";
import { createRequestFromHeaders } from "convex-zen/next";
import { requireSession } from "@/lib/auth-server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const request = createRequestFromHeaders({
    headers: await headers(),
    pathname: "/settings",
  });

  const auth = await requireSession(request).catch(() => redirect("/"));
  return <pre>{JSON.stringify(auth.session, null, 2)}</pre>;
}
```

## 3. Server fetchers with and without explicit `Request`

In App Router server components, no-request overloads are available:

```ts
import { fetchAuthQuery } from "@/lib/auth-server";
import { api } from "../../convex/_generated/api";

const user = await fetchAuthQuery(api.zen.core.currentUser, {});
```

In route handlers or middleware-like code where you already have a request, pass it directly:

```ts
import { fetchAuthQuery } from "@/lib/auth-server";
import { api } from "../../../convex/_generated/api";

export async function GET(request: Request) {
  const user = await fetchAuthQuery(request, api.zen.core.currentUser, {});
  return Response.json({ user });
}
```

## 4. Origin and proxy trust model

Non-GET auth endpoints reject cross-origin requests by default.

Recommended envs:

- `NEXT_PUBLIC_CONVEX_URL`: Convex deployment URL
- `CONVEX_SITE_URL`: app origin to trust for auth POSTs
- `NEXT_PUBLIC_APP_ORIGIN`: optional extra trusted app origin

If you are behind a trusted proxy and need forwarded IPs in sign-in input:

```ts
export const authServer = createNextAuthServer({
  convexUrl: process.env.NEXT_PUBLIC_CONVEX_URL as string,
  convexFunctions: api.zen,
  meta: authMeta,
  trustedProxy: true,
});
```

For stricter proxy control:

```ts
trustedProxy: (request) => request.headers.get("x-proxy-trusted") === "1"
```

For custom IP resolution:

```ts
getClientIp: (request) => request.headers.get("x-client-ip") ?? undefined
```

## 5. Factory mode for env-driven initialization

`createNextAuthServerFactory(...)` is useful when envs might be missing in some deployments:

```ts
import { createNextAuthServerFactory } from "convex-zen/next";

const authFactory = createNextAuthServerFactory({
  convexFunctions: api.zen,
  meta: authMeta,
});

export const handler = authFactory.handler;
```

To disable automatic trusted-origin env ingestion:

```ts
const authFactory = createNextAuthServerFactory({
  convexFunctions: api.zen,
  meta: authMeta,
  trustedOriginsFromEnv: false,
});
```
