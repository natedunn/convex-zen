# Next.js Installation (Convex Zen)

This guide walks through installing `convex-zen` in a Next.js App Router app.

## Prerequisites

- Node.js 20+
- `pnpm`
- A Convex account (for a deployment URL)

## 1. Create a Next.js app

Create a Next.js app with the App Router, then open the app directory:

```bash
cd <your-app>
```

If you already have a Next app, continue from here.

## 2. Install dependencies

```bash
pnpm add convex convex-zen
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
        billing: ["read"],
      },
      roles: {
        owner: {
          billing: ["read"],
        },
        admin: {
          billing: ["read"],
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

This creates generated wrappers used by the Next adapter (for example `convex/zen/core.ts` and `convex/zen/shared.ts`).

For provider callback URLs, Convex env setup, and the shared browser flow, see:
- [oauth.md](./oauth.md)
- [organizations.md](./organizations.md)

## 7. Wire Next server + client auth

Create `src/lib/auth-server.ts`:

```ts
import { createNextAuthServer } from "convex-zen/next";
import { api } from "../../convex/_generated/api";
import { authMeta } from "../../convex/zen/_generated/meta";

const authServer = createNextAuthServer({
  convexUrl: process.env.NEXT_PUBLIC_CONVEX_URL as string,
  convexFunctions: api.zen,
  meta: authMeta,
});

export const {
  handler,
  getSession,
  getToken,
  isAuthenticated,
  requireSession,
  fetchAuthQuery,
} = authServer;
```

Create `src/lib/auth-client.ts`:

```ts
import { createNextAuthClient } from "convex-zen/next";
import { api } from "../../convex/_generated/api";
import { authMeta } from "../../convex/zen/_generated/meta";

export const authClient = createNextAuthClient({
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

Create `app/api/auth/[...auth]/route.ts`:

```ts
import { handler } from "@/lib/auth-server";

export const GET = handler;
export const POST = handler;
```

## 8. Add protected route checks

Example protected page:

```tsx
// app/dashboard/page.tsx
import { isAuthenticated } from "@/lib/auth-server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  if (!(await isAuthenticated("/dashboard"))) {
    redirect("/");
  }

  return <h1>Protected dashboard</h1>;
}
```

## 9. Optional authenticated server fetchers

In a server component, you can call auth fetchers without building a `Request`:

```tsx
import { fetchAuthQuery } from "@/lib/auth-server";
import { api } from "../../convex/_generated/api";

export default async function Page() {
  const user = await fetchAuthQuery(api.zen.core.currentUser, {});
  return <pre>{JSON.stringify(user, null, 2)}</pre>;
}
```

## 10. Configure env vars and run

Create `.env.local`:

```bash
NEXT_PUBLIC_CONVEX_URL=https://<your-deployment>.convex.cloud
CONVEX_SITE_URL=http://localhost:3000
CONVEX_ZEN_SECRET=<your-random-secret>
```

Set the same secret in Convex:

```bash
pnpm exec convex env set CONVEX_ZEN_SECRET "<your-random-secret>"
```

Start Convex and Next:

```bash
pnpm exec convex dev
pnpm dev
```

## 11. Portless / custom local origins (optional)

If you run Next behind a custom dev host (for example Portless), add that host to Next's `allowedDevOrigins`:

```ts
// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["next.localhost", "*.next.localhost"],
};

export default nextConfig;
```

Also set `CONVEX_SITE_URL` (or `NEXT_PUBLIC_APP_ORIGIN`) to that app origin so auth origin checks trust your dev host.

For advanced server usage patterns, see:
- `apps/docs/external/next-server-patterns.md`
