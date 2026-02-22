# convex-zen docs (draft)

This folder documents the new package-first integration model for `convex-zen`.

## Import Distinction

- Baseline reference project: https://github.com/get-convex/better-auth
- Baseline reference docs: https://labs.convex.dev/better-auth
- `convex-zen` does not import Better Auth runtime into the app. It reimplements auth natively inside Convex components and exposes framework entrypoints from `convex-zen/<framework>`.

Goals:

1. Keep auth logic in `convex-zen`, not in app-specific glue code.
2. Expose stable framework-agnostic primitives.
3. Add framework adapters via dedicated exports (`convex-zen/tanstack-start`, etc.).
4. Keep function-side auth data flow explicit and consistent with Convex component constraints.

Read in order:

1. `apps/docs/01-architecture.md`
2. `apps/docs/02-core-primitives.md`
3. `apps/docs/03-tanstack-start.md`
4. `apps/docs/04-convex-function-auth-data.md`
5. `apps/docs/05-react-context.md`
