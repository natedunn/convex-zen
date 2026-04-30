# OAuth Proxy / Broker Mode

Use OAuth proxy mode when a provider only allows one redirect URI but you still need:

- multiple preview URLs
- a stable `auth.example.com` callback host
- Expo callbacks that return through the same broker

Direct OAuth remains the default. Proxy mode is opt-in.

## How it works

There are three roles:

- Consumer: starts OAuth from the app, receives a one-time handoff code back, then establishes its own session locally.
- Broker: owns the provider callback URL and converts the provider callback into a one-time handoff code.
- Hybrid: can do both.

The broker never puts a session token in the URL and never establishes a browser session for itself during proxy completion.

## Config split

Put broker policy in `convex/zen.config.ts`:

```ts
export default defineConvexZen({
  oauthProxy: {
    allowedReturnTargets: [
      { type: "webUrl", url: "https://app.example.com" },
      { type: "webUrlPattern", pattern: "https://*.vercel.app" },
    ],
  },
});
```

Then enable proxy mode in the web framework adapter:

```ts
const authServer = createNextAuthServer({
  convexUrl: process.env.NEXT_PUBLIC_CONVEX_URL as string,
  convexFunctions: api.zen,
  meta: authMeta,
  oauthProxy: true,
});
```

Set `CONVEX_ZEN_PROXY_BROKER` in the app environment when that app should act as a consumer or hybrid.

`brokerOrigin` makes the app a consumer.

`allowedReturnTargets` in `zen.config.ts` makes the app a broker.

## Expo config

Expo uses the same broker but returns to the app callback URL:

```ts
oauthProxy: {
  brokerOrigin: "https://auth.example.com",
}
```

The Expo callback URL becomes the broker `returnTarget`, for example `myapp://oauth`.

## Allowed return targets

Allowed rules are explicit and constrained:

```ts
type OAuthProxyReturnTargetRule =
  | { type: "webUrl"; url: string }
  | { type: "webUrlPattern"; pattern: string }
  | { type: "nativeCallback"; callbackUrl: string };
```

Rule types:

| Type | Use for | Example |
| --- | --- | --- |
| `webUrl` | One exact web app URL/origin | `https://app.example.com` |
| `webUrlPattern` | Many web preview or subdomain URLs under one host pattern | `https://*.vercel.app` |
| `nativeCallback` | One exact native callback URL | `myapp://oauth` |

Rules:

- `webUrl` is an exact web app URL/origin.
- `webUrlPattern` supports hostname wildcards like `https://*.vercel.app`.
- `nativeCallback` is an exact callback URL like `myapp://oauth`.
- No regex.
- No path wildcards.

## Route flow

Web consumer flow:

1. User starts at `/api/auth/sign-in/:provider`.
2. The adapter redirects to `https://auth.example.com/api/auth/proxy/sign-in/:provider`.
3. The broker completes the provider callback at `/api/auth/callback/:provider`.
4. The broker redirects back to the app exchange route with `?oauth_proxy_code=...`.
5. The consumer exchanges that one-time code and sets its own first-party session cookie.

Expo flow:

1. Expo opens the broker sign-in URL.
2. The broker completes the provider callback on the stable web origin.
3. The broker redirects to the Expo callback URL with `?oauth_proxy_code=...`.
4. Expo calls `completeOAuthProxy(...)` to establish local auth state.

## Callback URLs to register

In the provider console, register the broker callback URL, not each preview URL:

- `https://auth.example.com/api/auth/callback/google`
- `https://auth.example.com/api/auth/callback/github`
- `https://auth.example.com/api/auth/callback/discord`

## Security model

- Broker handoff codes are single-use.
- Broker handoff codes expire after 60 seconds.
- `redirectTo` and `errorRedirectTo` must still be relative paths.
- Broker return targets are validated before OAuth starts.
- Session tokens are never placed in redirect URLs.

## When to use this

Use direct mode when each app origin can be registered with the provider.

Use proxy mode when you need one provider callback URL for many preview or consumer origins.
