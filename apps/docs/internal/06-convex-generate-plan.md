# 06 - Convex Function Generation Plan

## Source of truth

- user-authored file: `convex/zenConvex.ts`
  - exports `authOptions`
  - exports `auth`

## Generated outputs

- `convex/auth/core.ts`
- `convex/auth/plugin/<plugin>.ts`
- `convex/auth/plugin/metaGenerated.ts`

`convex/_generated/*` remains Convex-owned.

## CLI behavior

Command:

- `npx convex-zen generate`

Flags:

- `--cwd`
- `--check`
- `--verbose`

Behavior:

1. Read `convex/zenConvex.ts`.
2. Detect enabled built-in plugins (currently admin).
3. Generate core + plugin wrappers.
4. Generate `metaGenerated.ts` by collecting plugin function kinds (`query|mutation|action`) from plugin wrapper files.
5. Print created/updated/deleted/unchanged summary.

## Runtime contract

- `createTanStackAuthServer({ convexFunctions: api.auth, pluginMeta: authPluginMeta })`
- `createTanStackAuthClient({ convexFunctions: api.auth, pluginMeta: authPluginMeta })`
- Auto route path: `/api/auth/plugin/<plugin>/<function>`
- Auto client path: `authClient.plugin.<plugin>.<function>()`

## Guardrails

- Generated-file marker required for overwrite/delete.
- `--check` exits non-zero when generated files drift.
- Clear runtime errors when metadata references missing plugin refs.

## Plugin feature checklist

When adding plugin features:

1. Add/update wrapper exports in `convex/auth/plugin/<plugin>.ts`.
2. Re-run `npx convex-zen generate` (refreshes `metaGenerated.ts`).
3. Re-run `npx convex codegen`.
4. Verify:
   - server route works at `/api/auth/plugin/<plugin>/<function>`
   - client method exists at `authClient.plugin.<plugin>.<function>()`.
