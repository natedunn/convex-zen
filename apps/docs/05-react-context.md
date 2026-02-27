# 05 - React Context Wrapper (`convex-zen/react`)

Import distinction baseline:

- https://github.com/get-convex/better-auth
- https://labs.convex.dev/better-auth

The React surface is intentionally familiar to existing Convex + Better Auth users, but is backed by `convex-zen` native Convex-component auth flows.

## What was added

File: `packages/convex-zen/src/client/react.ts`

Exports:

- `ConvexZenAuthProvider`
- `useConvexZenAuth`
- `useAuth` (alias)
- `useSession`

## Purpose

Provide a consistent client-side session state/hook layer that works with any React runtime, while keeping storage transport outside the component.

Current demo integration:

- Shared TanStack auth setup is centralized in `apps/tanstack/src/lib/auth-server.ts`
- `getSession` server function wrapper and `authClient` are centralized in `apps/tanstack/src/lib/auth-client.ts`
- sign-in/sign-out transport is handled by dynamic API route `apps/tanstack/src/routes/api.auth.$.tsx`
- Provider is mounted in `apps/tanstack/src/routes/__root.tsx`
- `initialSession` is sourced from root route SSR `beforeLoad`
- `authClient` includes `getSession`, `signInWithEmail` (`signIn.email` alias), and `signOut`
- `authClient` can expose plugin methods via auto mode (for example `authClient.plugin.admin.*`)
- client boilerplate can be generated with `createTanStackAuthClient(...)` from `convex-zen/tanstack-start-client`
- TanStack Query + Convex client providers are wired at the router level in `apps/tanstack/src/router.tsx`

The provider expects a small client interface:

```ts
{
  getSession: () => Promise<SessionInfo | null>;
}
```

That means:

- TanStack Start can back this with server functions/cookies.
- Next.js can back this with route handlers/server actions.
- React SPA can back this with fetch/XHR calls to your backend endpoints.

## Example

```ts
import { ConvexZenAuthProvider, useAuth } from "convex-zen/react";

function AppRoot() {
  return (
    <ConvexZenAuthProvider client={authClient}>
      <App />
    </ConvexZenAuthProvider>
  );
}

function Profile() {
  const { status, session, refresh } = useAuth();
  if (status === "loading") return <p>Loading...</p>;
  if (!session) return <p>Signed out</p>;

  return (
    <div>
      <p>{session.userId}</p>
      <button onClick={() => void refresh()}>Refresh session</button>
    </div>
  );
}
```
