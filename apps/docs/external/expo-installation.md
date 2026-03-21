# Expo installation

`convex-zen/expo` is the native-storage auth client for managed Expo apps.

It differs from the Next.js and TanStack Start integrations in one important way:

- Expo does not use `/api/auth/*` routes.
- Expo does not use cookies.
- Expo stores the session token locally and calls Convex public auth functions directly.

## Install

Add the library and the Expo-native runtime dependencies:

```bash
pnpm add convex convex-zen expo-auth-session expo-secure-store expo-web-browser react-native-url-polyfill
```

If you are using Expo Router, also install the usual router dependencies for your app.

## Convex functions to expose

Expo needs the public auth functions generated in your app, typically from `convex/zen/core.ts`.

Minimum required refs:

- `signInWithEmail`
- `validateSession`
- `invalidateSession`
- `getOAuthUrl`
- `handleOAuthCallback`

If you want generated `authClient.core.*` methods such as `authClient.currentUser({})`, also pass `coreMeta` or `authMeta.core`.

## Create the Expo auth client

```ts
import * as SecureStore from "expo-secure-store";
import {
  createExpoAuthClient,
  createKeyValueStorageAuthStorage,
} from "convex-zen/expo";
import { api } from "../convex/_generated/api";
import { authMeta } from "../convex/zen/shared";

const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL!;

export const authClient = createExpoAuthClient({
  convexUrl,
  convexFunctions: {
    core: {
      signInWithEmail: api.zen.core.signInWithEmail,
      validateSession: api.zen.core.validateSession,
      invalidateSession: api.zen.core.invalidateSession,
      getOAuthUrl: api.zen.core.getOAuthUrl,
      handleOAuthCallback: api.zen.core.handleOAuthCallback,
      currentUser: api.zen.core.currentUser,
    },
  },
  meta: authMeta,
  runtime: {
    storage: createKeyValueStorageAuthStorage({
      getItem: (key) => SecureStore.getItemAsync(key),
      setItem: (key, value) => SecureStore.setItemAsync(key, value),
      removeItem: (key) => SecureStore.deleteItemAsync(key),
    }),
  },
});
```

## Convex React note

The Expo example uses direct auth client calls and does not authenticate a `ConvexReactClient` with the session token.

That distinction matters because the Expo session token is not the same thing as a Convex identity JWT. If you want a fully authenticated `ConvexReactClient`, add an identity-JWT bridge instead of passing the raw session token through `setAuth(...)`.

## Email/password sign-in

```ts
const session = await authClient.signIn.email({
  email: "hello@example.com",
  password: "password123",
});
```

Session restore is token-based:

```ts
const session = await authClient.getSession();
```

Sign-out clears both the Convex session and the locally persisted token:

```ts
await authClient.signOut();
```

## Generated core/plugin methods

If you pass metadata, Expo can generate direct callable methods:

```ts
const currentUser = await authClient.currentUser({});
const sameUser = await authClient.core.currentUser({});
```

Plugin methods work the same way when you provide nested `plugin` refs plus `pluginMeta`.

## Example app

See `apps/expo` for a runnable managed Expo example with:

- `expo-secure-store`
- `expo-auth-session`
- Expo Router
- manual OAuth callback completion
- generated `currentUser` calls via `authClient.currentUser({})`
