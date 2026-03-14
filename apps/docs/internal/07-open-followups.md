# 07 - Open Follow-ups

This file tracks active follow-ups that are not implemented yet.

## Auth runtime adapters

1. Add an optional React auth-runtime adapter helper.
2. Add optional TanStack Router guard helpers for authenticated route checks.

## Framework expansion

1. Decide whether the Expo adapter should remain Expo-scoped or become the basis for broader React Native support.
2. Evaluate additional runtime adapters for future framework targets beyond Expo/TanStack Start/Next.js.

## Next.js parity backlog (post-compaction)

Recommended order:

1. Decide and document client API parity level vs TanStack.
   - Decide whether Next client should remain intentionally slim or adopt TanStack-style auto alias/plugin route ergonomics.
   - Write explicit “what parity means” guidance to avoid drift in future changes.
2. Expand Next-specific tests further.
   - Add matrix coverage for more host/proxy combinations (`localhost`, `127.0.0.1`, `next.localhost`, `feature.next.localhost`) in integration-level tests.
   - Add server helper behavior coverage for `isAuthenticated` in app-router contexts.
