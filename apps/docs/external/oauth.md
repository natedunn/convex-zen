# OAuth (Convex Zen)

This guide covers the shared OAuth model in `convex-zen` across Next.js and TanStack Start.

## Supported built-in providers

`convex-zen` currently ships first-class helpers for:

- `googleProvider(...)`
- `githubProvider(...)`
- `discordProvider(...)`

Configure them in `convex/zen.config.ts`:

```ts
import {
  ConvexZen,
  discordProvider,
  githubProvider,
  googleProvider,
} from "convex-zen";
import { components } from "./_generated/api";

export const authOptions = {
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
};

export const auth = new ConvexZen(components.convexAuth, authOptions);
```

## Provider secrets

Set provider secrets in Convex, not `.env.local`:

```bash
pnpm exec convex env set GITHUB_CLIENT_ID "<value>"
pnpm exec convex env set GITHUB_CLIENT_SECRET "<value>"
pnpm exec convex env set GOOGLE_CLIENT_ID "<value>"
pnpm exec convex env set GOOGLE_CLIENT_SECRET "<value>"
pnpm exec convex env set DISCORD_CLIENT_ID "<value>"
pnpm exec convex env set DISCORD_CLIENT_SECRET "<value>"
```

## Callback URLs

The built-in browser flow uses:

- `GET /api/auth/sign-in/:provider`
- `GET /api/auth/callback/:provider`

Register these callback URLs in the provider console for your app origin:

- `${APP_ORIGIN}/api/auth/callback/google`
- `${APP_ORIGIN}/api/auth/callback/github`
- `${APP_ORIGIN}/api/auth/callback/discord`

Examples:

- Next.js dev: `http://localhost:3000/api/auth/callback/google`
- TanStack Start dev: `http://localhost:3000/api/auth/callback/google`
- Portless/custom dev host: `http://your-app.localhost:1355/api/auth/callback/google`

## Browser flow

Both framework clients support the route-backed flow:

```ts
await authClient.signIn.oauth("google", {
  redirectTo: "/dashboard",
  errorRedirectTo: "/signin",
});
```

Behavior:

- starts at `/api/auth/sign-in/:provider`
- redirects to the provider
- completes at `/api/auth/callback/:provider`
- establishes the normal auth session cookie
- redirects to `redirectTo` on success
- redirects to `errorRedirectTo` with error params on failure

## Redirect safety

`redirectTo` and `errorRedirectTo` must be relative paths on the current origin.

Allowed:

- `/dashboard`
- `/signin?tab=oauth`

Rejected:

- `https://evil.example/steal`
- `//evil.example`

## Lower-level Convex flow

The lower-level flow still exists for custom browser flows such as popups or manual redirects:

- `getOAuthUrl`
- `handleOAuthCallback`

Use the framework routes unless you specifically need lower-level control.

## Built-in email trust

The built-in providers trust verified email claims and can:

- create new users from a verified provider email
- auto-link to an existing same-email user
- mark the resulting user email as verified

For custom providers, see [custom-oauth-providers.md](./custom-oauth-providers.md).
