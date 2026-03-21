# 05 - React Context Wrapper (`convex-zen/react`)

Import distinction baseline:

- https://github.com/get-convex/better-auth
- https://labs.convex.dev/better-auth

The React surface is intentionally familiar to existing Convex + Better Auth users, but is backed by `convex-zen` native Convex-component auth flows.

## What was added

File: `packages/convex-zen/src/client/react.ts`

Exports:

- `ConvexZenAuthProvider`
- `useZenSession`
- `useSession` (alias)

## Purpose

Provide a consistent React auth context with:

- reactive session state
- a minimal provider contract

Current demo integration:

- Shared TanStack auth setup is centralized in `apps/tanstack/src/lib/auth-server.ts`
- `getSession` server function wrapper and `authClient` are centralized in `apps/tanstack/src/lib/auth-client.ts`
- sign-in/sign-out transport is handled by dynamic API route `apps/tanstack/src/routes/api.zen.$.tsx`
- Provider is mounted in `apps/tanstack/src/routes/__root.tsx`
- `initialSession` is sourced from root route SSR `beforeLoad`
- `authClient` includes `getSession`, `signIn.email`, and `signOut`
- `authClient` can expose plugin methods via auto mode (for example `authClient.plugin.admin.*`)
- client boilerplate is generated with:
  - `createTanStackAuthClient(...)` (route methods + dependency-free query/mutation/action helpers on plugin + core methods)
- TanStack Query + Convex client providers are wired at the router level in `apps/tanstack/src/router.tsx`

The provider still only requires a client with:

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
import { ConvexZenAuthProvider, useZenSession } from "convex-zen/react";
import { authClient } from "./auth-client";

function AppRoot() {
  return (
    <ConvexZenAuthProvider client={authClient}>
      <App />
    </ConvexZenAuthProvider>
  );
}

function Profile() {
  const { status, session, refresh } = useZenSession();
  const organization = authClient.plugin.organization;
  if (status === "loading") return <p>Loading...</p>;
  if (!session) return <p>Signed out</p>;

  return (
    <div>
      <p>{session.userId}</p>
      <button onClick={() => void authClient.signOut()}>Sign out</button>
      <button onClick={() => void organization.listOrganizations()}>
        Load orgs
      </button>
      <button onClick={() => void refresh()}>Refresh session</button>
    </div>
  );
}
```
