# convex-zen

Production-grade authentication for Convex, built as a reusable component package.

## Import Distinction

`convex-zen` is intentionally different from the Convex Better Auth integration:

- Baseline reference: https://github.com/get-convex/better-auth
- Baseline docs: https://labs.convex.dev/better-auth
- This project: native auth implementation inside Convex components (`packages/convex-zen`), with optional framework-specific exports like `convex-zen/tanstack-start`.

In short: we do not import Better Auth runtime into app code. We keep auth logic in Convex component functions and expose a familiar integration surface.

## Package name

```bash
npm install convex-zen
```

## Workspace

- Library package: `packages/convex-zen`
- Demo app: `apps/tanstack`
- Draft integration docs: `apps/docs`
- Project architecture and design notes: `PROJECT.md`

## Quick start

```bash
pnpm install
pnpm -C apps/tanstack exec convex dev
pnpm -C apps/tanstack dev
```

## Testing and build

```bash
pnpm -C packages/convex-zen test
pnpm -C packages/convex-zen build
pnpm -C apps/tanstack build
```

## License and attribution

- Repository license: `LICENSE` (Apache License 2.0)
- Required notices: `NOTICE`
- Third-party provenance and notices: `THIRD_PARTY_NOTICES.md`

When external code is copied or substantially adapted, source repo/path/commit and license details must be recorded in `THIRD_PARTY_NOTICES.md`.
