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

If you enable OAuth, register these callback URLs with the provider consoles:

- `http://localhost:3000/api/auth/callback/google`
- `http://localhost:3000/api/auth/callback/github`
- `http://localhost:3000/api/auth/callback/discord`
- Portless dev example: `http://tanstack.convex-zen.localhost:1355/api/auth/callback/:provider`

Set provider secrets in Convex, not `.env.local`:

```bash
pnpm exec convex env set GITHUB_CLIENT_ID "<value>"
pnpm exec convex env set GITHUB_CLIENT_SECRET "<value>"
pnpm exec convex env set GOOGLE_CLIENT_ID "<value>"
pnpm exec convex env set GOOGLE_CLIENT_SECRET "<value>"
pnpm exec convex env set DISCORD_CLIENT_ID "<value>"
pnpm exec convex env set DISCORD_CLIENT_SECRET "<value>"
```

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
import { createTanStackAuthClient } from "convex-zen/tanstack-start";
import { api } from "../../convex/_generated/api";
import { authMeta } from "../../convex/auth/metaGenerated";

export const authClient = createTanStackAuthClient({
	convexFunctions: api.auth,
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

## Experimental custom OAuth providers

## Custom OAuth providers

`convex-zen` also exposes a fully functional custom provider API. The built-in
providers (`googleProvider`, `githubProvider`, `discordProvider`) use the same
runtime contract internally, so they are the canonical reference implementations
for custom providers.

Define custom providers in `convex/zen.config.ts` so their runtimes register when
the Convex auth modules load:

```ts
import {
	ConvexZen,
	buildOAuthAuthorizationUrl,
	defineOAuthProvider,
	exchangeOAuthAuthorizationCode,
	requireOAuthVerifiedEmail,
} from "convex-zen";

const acmeProvider = defineOAuthProvider({
	id: "acme",
	createConfig: (config: {
		clientId: string;
		clientSecret: string;
		tenant: string;
	}) => ({
		id: "acme",
		clientId: config.clientId,
		clientSecret: config.clientSecret,
		trustVerifiedEmail: true,
		authorizationUrl: "https://acme.example/oauth/authorize",
		tokenUrl: "https://acme.example/oauth/token",
		userInfoUrl: "https://acme.example/api/me",
		scopes: ["profile", "email"],
		runtimeConfig: {
			tenant: config.tenant,
		},
	}),
	runtime: {
		buildAuthorizationUrl: (provider, args) =>
			buildOAuthAuthorizationUrl(provider, args),
		exchangeAuthorizationCode: async (provider, args) =>
			await exchangeOAuthAuthorizationCode(provider, args),
		fetchProfile: async (provider, tokens) => {
			const response = await fetch(provider.userInfoUrl, {
				headers: {
					Authorization: `Bearer ${tokens.accessToken}`,
				},
			});
			const profile = await response.json();
			return {
				accountId: profile.id,
				email: profile.email,
				emailVerified: profile.email_verified === true,
				name: profile.name,
				image: profile.avatar_url,
			};
		},
		requireVerifiedEmail: (profile) =>
			requireOAuthVerifiedEmail(profile),
	},
});

export const authOptions = {
	providers: [
		acmeProvider({
			clientId: process.env.ACME_CLIENT_ID!,
			clientSecret: process.env.ACME_CLIENT_SECRET!,
			tenant: "workspace-1",
		}),
	],
};
```

You can start the route-backed browser flow with the custom id:

```ts
await authClient.signIn.oauth("acme", {
	redirectTo: "/dashboard",
	errorRedirectTo: "/signin",
});
```

Custom providers are intended for real use, but the provider contract may still
evolve before it is declared stable. Check the changelog when upgrading.

Custom providers do not trust verified email claims by default. Set
`trustVerifiedEmail: true` only when the provider guarantees verified emails you
are comfortable using for new-user creation and automatic email-based linking.

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
