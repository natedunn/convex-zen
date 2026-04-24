# convex-zen internal docs

This folder documents the package-first integration model for `convex-zen`.

## Positioning

`convex-zen` is a native Convex auth component and an alternative to:

- the Better Auth Convex component: https://github.com/get-convex/better-auth
- Convex Auth: https://labs.convex.dev/auth

It exposes framework entrypoints from `convex-zen/<framework>` while keeping auth logic inside Convex components.

Goals:

1. Keep auth logic in `convex-zen`, not in app-specific glue code.
2. Expose stable framework-agnostic primitives.
3. Add framework adapters via dedicated exports (`convex-zen/tanstack-start`, etc.).
4. Keep function-side auth data flow explicit and consistent with Convex component constraints.

Read in order:

1. `apps/docs/internal/01-architecture.md`
2. `apps/docs/internal/02-core-primitives.md`
3. `apps/docs/internal/03-tanstack-start.md`
4. `apps/docs/internal/04-convex-function-auth-data.md`
5. `apps/docs/internal/05-react-context.md`
6. `apps/docs/internal/06-convex-generate-plan.md`
7. `apps/docs/internal/07-open-followups.md`
