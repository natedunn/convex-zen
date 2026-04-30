# Add convex-zen To An Existing TanStack Start + Convex App

Use this guide when:

- the app already uses TanStack Start
- Convex is already installed
- no auth solution is installed yet

## Create or update Convex files

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

export default defineSchema({});
```

Create `convex/zen.config.ts`:

```ts
import { defineConvexZen } from "convex-zen";

export default defineConvexZen({
  emailPassword: {
    sendVerification: async (to, code) => {
      console.log(`Verification email -> ${to}: ${code}`);
    },
    sendPasswordReset: async (to, code) => {
      console.log(`Password reset email -> ${to}: ${code}`);
    },
  },
  runtime: {
    tokenEncryptionSecretEnvVar: "CONVEX_ZEN_SECRET",
  },
});
```

Create `convex/auth.config.ts`:

```ts
import type { AuthConfig } from "convex/server";
import { createConvexZenIdentityJwt } from "convex-zen/tanstack-start/identity-jwt";

const authConfig: AuthConfig = {
  providers: [createConvexZenIdentityJwt().authProvider],
};

export default authConfig;
```

Generate wrappers:

```bash
npx convex-zen generate
```

## Create TanStack auth files

Use these example files as the canonical reference:

- `apps/tanstack/src/lib/auth-server.ts`
- `apps/tanstack/src/lib/auth-client.ts`
- `apps/tanstack/src/router.tsx`
- `apps/tanstack/src/routes/__root.tsx`
- `apps/tanstack/src/routes/api/auth/$.tsx`

Required app wiring:

- `src/lib/auth-server.ts` must use `createTanStackAuthServer(...)`
- `src/lib/auth-client.ts` must use `createTanStackAuthClient(...)`
- `src/router.tsx` must connect Convex auth with `authClient.connectConvexAuth(...)`
- `src/routes/__root.tsx` must mount `ConvexZenAuthProvider`
- `src/routes/api/auth/$.tsx` must expose the auth handler

## Minimal env vars

```bash
VITE_CONVEX_URL=https://<your-deployment>.convex.cloud
CONVEX_ZEN_SECRET=<your-random-secret>
```

Set the same secret in Convex:

```bash
pnpm exec convex env set CONVEX_ZEN_SECRET "<your-random-secret>"
```

## Optional: one-shot OAuth setup

If the user asks for Google, GitHub, Discord, or custom OAuth during install, do it in the same pass:

- add providers to `convex/zen.config.ts`
- set provider secrets in Convex with `pnpm exec convex env set ...`
- keep the normal `authClient.signIn.oauth(...)` route-backed flow

Choose direct OAuth when the provider can register each app origin directly. Register callback URLs like `${APP_ORIGIN}/api/auth/callback/google`.

Choose proxy mode when the provider only allows one redirect URI, the app needs preview URLs, or the user wants a stable broker such as `https://auth.example.com`. In proxy mode:

- add `oauthProxy.allowedReturnTargets` to `convex/zen.config.ts`
- set `oauthProxy: true` in `createTanStackAuthServer(...)`
- set `CONVEX_ZEN_PROXY_BROKER=https://auth.example.com` in the app environment
- register the provider callback at `https://auth.example.com/api/auth/callback/<provider>`

References:

- `apps/docs/external/oauth.md`
- `apps/docs/external/oauth-proxy.md`

## Done means

- `npx convex-zen generate` succeeds
- `convex/zen/_generated/meta.ts` exists
- `src/router.tsx` wires direct Convex auth
- `src/routes/__root.tsx` mounts the auth provider
- the auth route exists at `src/routes/api/auth/$.tsx`
