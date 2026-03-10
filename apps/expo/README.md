# Expo Example

Managed Expo example for `convex-zen/expo`.

## Setup

1. Copy `.env.example` to `.env`.
2. Set `EXPO_PUBLIC_CONVEX_URL` to your Convex deployment URL.
3. Set `EXPO_PUBLIC_APP_SCHEME` to the custom scheme you register with your OAuth provider.
4. Start Convex in your app project and expose the public auth functions shown in `src/authFunctions.ts`.

## Commands

```bash
pnpm -C apps/expo start
pnpm -C apps/expo typecheck
pnpm -C apps/expo build
```

## Notes

- Tokens are persisted with `expo-secure-store`.
- OAuth uses a deep-link callback URL built with `expo-auth-session`.
- The example calls Convex auth functions directly through `convex-zen/expo`; it does not use `/api/auth/*` routes.
