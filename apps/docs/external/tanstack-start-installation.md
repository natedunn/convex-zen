# TanStack Start Installation (Convex Zen)

This guide walks through installing `convex-zen` in a TanStack Start app.

## Prerequisites

- Node.js 20+
- `pnpm`
- A Convex account (for a deployment URL)

## 1. Create a TanStack Start app

Create a new TanStack Start app with the current official scaffold command, then open the app directory.

```bash
cd <your-app>
```

If you already have a TanStack Start app, continue from here.

## 2. Install dependencies

```bash
pnpm add convex convex-zen @convex-dev/react-query @tanstack/react-query
pnpm add -D concurrently
```

## 3. Add Convex app wiring

Create `convex/convex.config.ts`:

```ts
import { defineApp } from "convex/server";
import convexAuth from "convex-zen/convex.config";

const app = defineApp();
app.use(convexAuth);

export default app;
```

Create `convex/schema.ts`:

```ts
import { defineSchema } from "convex/server";

// Auth tables are owned by the convexAuth component.
export default defineSchema({});
```

## 4. Configure Convex Zen auth

Create `convex/zen.config.ts`:

```ts
import { ConvexZen } from "convex-zen";
import { adminPlugin } from "convex-zen/plugins/admin";
import { components } from "./_generated/api";

export const authOptions = {
	emailProvider: {
		sendVerificationEmail: async (to: string, code: string) => {
			console.log(`Verification email -> ${to}: ${code}`);
		},
		sendPasswordResetEmail: async (to: string, code: string) => {
			console.log(`Password reset email -> ${to}: ${code}`);
		},
	},
	requireEmailVerified: true,
	plugins: [adminPlugin({ defaultRole: "user", adminRole: "admin" })],
};

export const auth = new ConvexZen(components.convexAuth, authOptions);
```

## 5. Add Convex auth provider config

Create `convex/auth.config.ts`:

```ts
import type { AuthConfig } from "convex/server";
import { createConvexZenIdentityJwt } from "convex-zen/tanstack-start/identity-jwt";

const authConfig: AuthConfig = {
	providers: [createConvexZenIdentityJwt().authProvider],
};

export default authConfig;
```

## 6. Generate Convex auth wrappers

Run:

```bash
npx convex-zen generate
```

This creates generated wrappers used by the TanStack adapter (for example `convex/auth/core.ts` and `convex/auth/metaGenerated.ts`).

## 7. Wire TanStack Start server + client auth

Create `src/lib/auth-server.ts`:

```ts
import { createTanStackAuthServer } from "convex-zen/tanstack-start";
import { api } from "../../convex/_generated/api";
import { authMeta } from "../../convex/auth/metaGenerated";

const authServer = createTanStackAuthServer({
	convexUrl: import.meta.env["VITE_CONVEX_URL"] as string,
	convexFunctions: api.auth,
	meta: authMeta,
});

export const { handler, getSession } = authServer;
```

Create `src/lib/auth-client.ts`:

```ts
import { createTanStackQueryAuthClient } from "convex-zen/tanstack-start-client";
import { api } from "../../convex/_generated/api";
import { authMeta } from "../../convex/auth/metaGenerated";

export const authClient = createTanStackQueryAuthClient({
	convexFunctions: api.auth,
	meta: authMeta,
});
```

Create `src/routes/api.auth.$.tsx`:

```tsx
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

## 8. Connect Convex client + auth provider

Update `src/router.tsx` so the Convex client is connected to the auth client:

```ts
import { ConvexReactClient } from "convex/react";
import { connectConvexZen } from "convex-zen/tanstack-start-client";
import { authClient } from "./lib/auth-client";

function createRouterContext() {
	const convex = new ConvexReactClient(
		import.meta.env["VITE_CONVEX_URL"] as string,
	);

	// Binds Convex requests to the current auth token/session.
	connectConvexZen(authClient, convex);

	return { convex };
}
```

Then mount the auth provider in `src/routes/__root.tsx`:

```tsx
import { ConvexProvider } from "convex/react";
import { ConvexZenAuthProvider } from "convex-zen/react";
import {
	createRootRouteWithContext,
	Outlet,
	useRouteContext,
} from "@tanstack/react-router";
import { authClient } from "../lib/auth-client";
import type { RouterContext } from "../router";

export const Route = createRootRouteWithContext<RouterContext>()({
	component: RootComponent,
});

function RootComponent() {
	const context = useRouteContext({ from: Route.id });

	return (
		<ConvexZenAuthProvider
			client={authClient}
			initialSession={context.session}
		>
			<ConvexProvider client={context.convex}>
				<Outlet />
			</ConvexProvider>
		</ConvexZenAuthProvider>
	);
}
```

## 9. Set environment variables and run

Create `.env.local`:

```bash
VITE_CONVEX_URL=https://<your-deployment>.convex.cloud
CONVEX_ZEN_SECRET=<your-random-secret>
```

Set the same secret in Convex:

```bash
pnpm exec convex env set CONVEX_ZEN_SECRET "<your-random-secret>"
```

Run:

```bash
pnpm exec convex dev
pnpm dev
```

## Convex Zen file tree at completion

```text
<your-app>/
├── .env.local
├── convex/
│   ├── auth.config.ts
│   ├── convex.config.ts
│   ├── schema.ts
│   ├── zen.config.ts
│   └── auth/
│       ├── core.ts                   # generated
│       ├── metaGenerated.ts          # generated
│       └── plugin/
│           ├── admin.ts              # generated when admin plugin is enabled
│           └── metaGenerated.ts      # generated
└── src/
    ├── lib/
    │   ├── auth-client.ts
    │   └── auth-server.ts
    ├── router.tsx
    └── routes/
        ├── __root.tsx
        └── api.auth.$.tsx
```
