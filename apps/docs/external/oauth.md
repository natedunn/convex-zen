# OAuth (Convex Zen)

This page covers the shared OAuth flow in `convex-zen` across:

- Next.js
- TanStack Start
- Expo

If your provider only allows a single redirect URI, see [oauth-proxy.md](./oauth-proxy.md).

## Supported built-in providers

Built-in helpers are available for:

- `googleProvider(...)`
- `githubProvider(...)`
- `discordProvider(...)`

Configure them in `convex/zen.config.ts`:

```ts
import {
  defineConvexZen,
  discordProvider,
  githubProvider,
  googleProvider,
} from "convex-zen";

export default defineConvexZen({
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
});
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

The built-in web browser flow uses:

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
- Expo deep link: `convexzenexpo://oauth`

If you need one stable callback host for many preview URLs, use proxy mode instead of registering each app origin separately. In proxy mode, the provider callback points at the broker host and the app receives a one-time `oauth_proxy_code` handoff. See [oauth-proxy.md](./oauth-proxy.md).

## Route-backed browser flow

Next.js and TanStack Start support the route-backed flow:

```ts
await authClient.signIn.oauth("google", {
  redirectTo: "/dashboard",
  errorRedirectTo: "/signin",
});
```

What happens:

- starts at `/api/auth/sign-in/:provider`
- redirects to the provider
- completes at `/api/auth/callback/:provider`
- establishes the normal auth session cookie
- redirects to `redirectTo` on success
- redirects to `errorRedirectTo` with error params on failure

## Proxy / broker mode

Proxy mode is for providers that only allow one redirect URI.

What changes:

- the provider callback is registered on a stable broker origin such as `https://auth.example.com`
- Next.js and TanStack Start redirect to the broker from the normal `/api/auth/sign-in/:provider` route
- the broker returns `oauth_proxy_code` to the final app
- the final app exchanges that one-time code and establishes its own session

Expo uses the same brokered model, but the final return target is your Expo callback URL.

See [oauth-proxy.md](./oauth-proxy.md) for full setup.

## Expo deep-link flow

Expo uses the lower-level Convex OAuth primitives directly instead of `/api/auth/*` routes.

Typical flow:

1. Call `authClient.signIn.oauth("google", { callbackUrl, redirectTo, errorRedirectTo })`.
2. Open the returned authorization URL with `expo-auth-session` / `expo-web-browser`.
3. Parse `code` and `state` from the Expo callback URL.
4. Finish auth with `authClient.completeOAuth(...)`.
5. Restore the authenticated session locally with the returned session token.

If you configure Expo with `oauthProxy`, the browser callback changes:

1. `signIn.oauth(...)` returns a broker URL instead of a provider URL from Convex.
2. The broker redirects back with `oauth_proxy_code`.
3. Finish auth with `authClient.completeOAuthProxy(...)`.

Example:

```ts
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";

const callbackUrl = AuthSession.makeRedirectUri({
  scheme: "convexzenexpo",
  path: "oauth",
});

const started = await authClient.signIn.oauth("google", {
  callbackUrl,
  redirectTo: "/home",
  errorRedirectTo: "/sign-in",
});

const browserResult = await WebBrowser.openAuthSessionAsync(
  started.authorizationUrl,
  callbackUrl
);

if (browserResult.type === "success" && browserResult.url) {
  const url = new URL(browserResult.url);
  const proxyCode = url.searchParams.get("oauth_proxy_code");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (proxyCode) {
    await authClient.completeOAuthProxy({ code: proxyCode });
  } else {
    if (!code || !state) throw new Error("Missing OAuth callback params");

    await authClient.completeOAuth({
      providerId: "google",
      code,
      state,
      callbackUrl,
      redirectTo: "/home",
      errorRedirectTo: "/sign-in",
    });
  }
}
```

In Expo, `redirectTo` and `errorRedirectTo` are still useful, but they are app-relative markers you handle after the callback rather than browser redirects handled by a server route.

## Redirect safety

`redirectTo` and `errorRedirectTo` must be relative paths on the current origin.

Allowed:

- `/dashboard`
- `/signin?tab=oauth`

Rejected:

- `https://evil.example/steal`
- `//evil.example`

## Lower-level Convex flow

These lower-level functions are available for Expo and for custom web flows such as popups or manual redirects:

- `getOAuthUrl`
- `handleOAuthCallback`
- `exchangeOAuthProxyCode`

Use the framework routes on the web unless you specifically need lower-level control. Use the direct Convex flow on Expo.

## Expo provider console setup

For Expo, register your custom scheme callback in the provider console.

Example Google redirect URI:

- `convexzenexpo://oauth`

Match that scheme to your Expo app config and to `AuthSession.makeRedirectUri(...)`.

## Troubleshooting

- Invalid callback URL
  - Verify the provider console callback exactly matches your Expo scheme URI or web callback route.
- Missing `state`
  - Make sure you pass the same `callbackUrl` into both `signIn.oauth(...)` and `completeOAuth(...)`.
- Stale session token
  - `authClient.getSession()` clears invalid persisted tokens automatically; if the user appears signed out after resume, re-run the sign-in flow.
- Storage adapter mistakes
  - Expo must persist the token somewhere durable such as `expo-secure-store`; memory storage will not survive app restarts.

## Built-in email trust

The built-in providers trust verified email claims and can:

- create new users from a verified provider email
- auto-link to an existing same-email user
- mark the resulting user email as verified

For custom providers, see [custom-oauth-providers.md](./custom-oauth-providers.md).
