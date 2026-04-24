# Add convex-zen To An Existing Next.js + Convex App

Use this guide when:

- the app already uses Next.js App Router
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
  emailProvider: {
    sendVerificationEmail: async (to, code) => {
      console.log(`Verification email -> ${to}: ${code}`);
    },
    sendPasswordResetEmail: async (to, code) => {
      console.log(`Password reset email -> ${to}: ${code}`);
    },
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

## Create Next auth files

Use these example files as the canonical reference:

- `apps/next/src/lib/auth-server.ts`
- `apps/next/src/lib/auth-client.ts`
- `apps/next/app/auth-provider.tsx`
- `apps/next/app/layout.tsx`
- `apps/next/app/api/auth/[...auth]/route.ts`

Required app wiring:

- `src/lib/auth-server.ts` must use `createNextAuthServer(...)`
- `src/lib/auth-client.ts` must use `createNextAuthClient(...)`
- `app/auth-provider.tsx` must mount `ConvexZenAuthProvider`
- `app/layout.tsx` must wrap the app with the auth provider
- `app/api/auth/[...auth]/route.ts` must export `GET` and `POST` from the handler

## Minimal env vars

```bash
NEXT_PUBLIC_CONVEX_URL=https://<your-deployment>.convex.cloud
CONVEX_SITE_URL=http://localhost:3000
CONVEX_ZEN_SECRET=<your-random-secret>
```

Set the same secret in Convex:

```bash
pnpm exec convex env set CONVEX_ZEN_SECRET "<your-random-secret>"
```

## Done means

- `npx convex-zen generate` succeeds
- `convex/zen/_generated/meta.ts` exists
- the Next auth route is present
- `app/layout.tsx` includes the auth provider wiring
- `app/auth-provider.tsx` exists and connects Convex auth
