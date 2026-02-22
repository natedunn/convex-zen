# convex-zen

Production-grade authentication for Convex, built as a reusable component package.

## Package name

```bash
npm install convex-zen
```

## Workspace

- Library package: `packages/convex-zen`
- Demo app: `apps/web`
- Project architecture and design notes: `PROJECT.md`

## Quick start

```bash
pnpm install
pnpm -C apps/web exec convex dev
pnpm -C apps/web dev
```

## Testing and build

```bash
pnpm -C packages/convex-zen test
pnpm -C packages/convex-zen build
pnpm -C apps/web build
```

## License and attribution

- Repository license: `LICENSE` (Apache License 2.0)
- Required notices: `NOTICE`
- Third-party provenance and notices: `THIRD_PARTY_NOTICES.md`

When external code is copied or substantially adapted, source repo/path/commit and license details must be recorded in `THIRD_PARTY_NOTICES.md`.
