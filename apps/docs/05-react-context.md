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

The provider expects a small client interface:

```ts
{
  getSession: () => Promise<SessionInfo | null>;
  signIn: (input) => Promise<SessionInfo>;
  signOut: () => Promise<void>;
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
  const { status, session, signOut } = useAuth();
  if (status === "loading") return <p>Loading...</p>;
  if (!session) return <p>Signed out</p>;

  return (
    <div>
      <p>{session.userId}</p>
      <button onClick={() => void signOut()}>Sign out</button>
    </div>
  );
}
```
