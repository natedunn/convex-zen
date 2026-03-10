# Custom OAuth Providers (Convex Zen)

This guide covers the public custom provider API in `convex-zen`.

The built-in providers (`googleProvider`, `githubProvider`, `discordProvider`) use the same runtime contract internally, so they are the canonical reference implementations.

## Define providers in `convex/zen.config.ts`

Custom providers should be defined in `convex/zen.config.ts` so their runtimes register when the Convex auth modules load.

```ts
import {
  ConvexZen,
  buildOAuthAuthorizationUrl,
  defineOAuthProvider,
  exchangeOAuthAuthorizationCode,
  requireOAuthVerifiedEmail,
} from "convex-zen";
import { components } from "./_generated/api";

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

export const auth = new ConvexZen(components.convexAuth, authOptions);
```

## Runtime contract

The provider helper returns a serializable config, and the runtime implements the provider behavior:

- `buildAuthorizationUrl`
- `exchangeAuthorizationCode`
- `fetchProfile`
- `requireVerifiedEmail`

The shared helpers are:

- `buildOAuthAuthorizationUrl(...)`
- `exchangeOAuthAuthorizationCode(...)`
- `requireOAuthVerifiedEmail(...)`

## `runtimeConfig`

Use `runtimeConfig` for provider-specific serialized options that do not belong in the stable top-level OAuth config shape.

The `tenant` field in the example is just an example of this pattern. It is not a built-in `convex-zen` OAuth option. It demonstrates how a provider can carry extra provider-specific values such as:

- tenant
- workspace ID
- organization slug
- realm
- audience

## `trustVerifiedEmail`

`trustVerifiedEmail` controls whether a provider's verified email claim is trusted for:

- new-user creation
- automatic email-based account linking
- marking the user email as verified

Built-in providers set `trustVerifiedEmail: true`.

Custom providers do not trust verified email claims by default. If a custom provider does not opt in:

- already-linked accounts can still sign in
- unlinked accounts are rejected instead of creating or auto-linking a user

Only set `trustVerifiedEmail: true` if the provider guarantees verified emails strongly enough that you want them to act as identity.

## Route-backed usage

Once a custom provider is configured, the framework clients can start it by provider id:

```ts
await authClient.signIn.oauth("acme", {
  redirectTo: "/dashboard",
  errorRedirectTo: "/signin",
});
```

## Stability

Custom providers are intended for real use, but the provider contract may still evolve before it is declared stable. Check the changelog when upgrading.
