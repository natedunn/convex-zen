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
import {
	ConvexZen,
	discordProvider,
	githubProvider,
	googleProvider,
} from "convex-zen";
import { adminPlugin } from "convex-zen/plugins/admin";
import { organizationPlugin } from "convex-zen/plugins/organization";
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
	providers: [
		githubProvider({
			clientId: process.env.GITHUB_CLIENT_ID!,
			clientSecret: process.env.GITHUB_CLIENT_SECRET!,
		}),
		googleProvider({
			clientId: process.env.GOOGLE_CLIENT_ID!,
			clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
		}),
		discordProvider({
			clientId: process.env.DISCORD_CLIENT_ID!,
			clientSecret: process.env.DISCORD_CLIENT_SECRET!,
		}),
	],
	requireEmailVerified: true,
	plugins: [
		adminPlugin({ defaultRole: "user", adminRole: "admin" }),
		organizationPlugin({
			accessControl: {
				project: ["write"],
			},
			roles: {
				owner: {
					project: ["write"],
				},
				admin: {
					project: ["write"],
				},
			},
			subdomainSuffix: "example.com",
		}),
	],
};

export const auth = new ConvexZen(components.convexAuth, authOptions);
```

## 5. Add Convex auth provider config

Create `convex/zen.config.ts`:

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

This creates generated wrappers used by the TanStack adapter (for example `convex/zen/core.ts` and `convex/zen/shared.ts`).

For provider callback URLs, Convex env setup, and the shared browser flow, see:
- [oauth.md](./oauth.md)
- [organizations.md](./organizations.md)

## 7. Wire TanStack Start server + client auth

Create `src/lib/auth-server.ts`:

```ts
import { createTanStackAuthServer } from "convex-zen/tanstack-start";
import { api } from "../../convex/_generated/api";
import { authMeta } from "../../convex/zen/shared";

const authServer = createTanStackAuthServer({
	convexUrl: import.meta.env["VITE_CONVEX_URL"] as string,
	convexFunctions: api.zen,
	meta: authMeta,
});

export const { handler, getSession } = authServer;
```

Create `src/lib/auth-client.ts`:

```ts
import { createTanStackAuthClient } from "convex-zen/tanstack-start";
import { api } from "../../convex/_generated/api";
import { authMeta } from "../../convex/zen/shared";

export const authClient = createTanStackAuthClient({
	convexFunctions: api.zen,
	meta: authMeta,
});
```

Route-backed OAuth is available through `authClient.signIn.oauth(...)`, for example:

```ts
await authClient.signIn.oauth("google", {
	redirectTo: "/dashboard",
	errorRedirectTo: "/signin",
});
```

For custom providers, shared runtime helpers, `runtimeConfig`, and `trustVerifiedEmail`, see:
- [custom-oauth-providers.md](./custom-oauth-providers.md)

Create `src/routes/api.zen.$.tsx`:

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
import { authClient } from "./lib/auth-client";

function createRouterContext() {
	const convex = new ConvexReactClient(
		import.meta.env["VITE_CONVEX_URL"] as string,
	);

	// Binds Convex requests to the current auth token/session.
	authClient.connectConvexAuth(convex);

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
│       ├── shared.ts          # generated
│       └── plugin/
│           ├── admin.ts              # generated when admin plugin is enabled
│           └── shared.ts      # generated
└── src/
    ├── lib/
    │   ├── auth-client.ts
    │   └── auth-server.ts
    ├── router.tsx
    └── routes/
        ├── __root.tsx
        └── api.zen.$.tsx
```
