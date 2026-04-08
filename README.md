# convex-zen

Production-grade authentication for Convex, built as a reusable component package.

## Import Distinction

`convex-zen` is intentionally different from the Convex Better Auth integration:

- Baseline reference: https://github.com/get-convex/better-auth
- Baseline docs: https://labs.convex.dev/better-auth
- This project: native auth implementation inside Convex components (`packages/convex-zen`), with framework-specific exports like `convex-zen/tanstack-start`, `convex-zen/next`, and `convex-zen/expo`.

In short: we do not import Better Auth runtime into app code. We keep auth logic in Convex component functions and expose a familiar integration surface.

## Packages

```bash
npm install convex convex-zen
```

Optional standalone plugins:

```bash
npm install convex convex-zen convex-zen-organization
npm install convex convex-zen convex-zen-system-admin
```

## Workspace

- Library package: `packages/convex-zen`
- Demo apps: `apps/tanstack`, `apps/next`, `apps/expo`
- Draft integration docs: `apps/docs`
- Project architecture and design notes: `PROJECT.md`

## Quick start

```bash
pnpm install
pnpm -C apps/tanstack exec convex dev
pnpm -C apps/tanstack dev
```

The main authoring flow is:

- define your auth config in `convex/zen.config.ts` with `defineConvexZen(...)`
- add the Convex auth bridge in `convex/auth.config.ts`
- run `npx convex-zen generate`
- wire your framework adapter to the generated refs and metadata

Expo example:

```bash
pnpm -C apps/expo typecheck
pnpm -C apps/expo build
pnpm -C apps/expo start
```

## Testing and build

```bash
pnpm -C packages/convex-zen test
pnpm -C packages/convex-zen build
pnpm -C packages/convex-zen build:dist
pnpm -C apps/tanstack build
pnpm -C apps/expo build
```

## License and attribution

- Repository license: `LICENSE` (Apache License 2.0)
- Required notices: `NOTICE`
- Third-party provenance and notices: `THIRD_PARTY_NOTICES.md`

When external code is copied or substantially adapted, source repo/path/commit and license details must be recorded in `THIRD_PARTY_NOTICES.md`.
