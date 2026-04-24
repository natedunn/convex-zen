# 06 - Convex Function Generation Plan

## Source of truth

- user-authored file: `convex/zen.config.ts`
  - exports the `defineConvexZen(...)` config object
  - is the only author-edited auth configuration input consumed by the generator

## Generated outputs

- `convex/zen/core.ts`
- `convex/zen/component/convex.config.ts`
- `convex/zen/component/_runtime.ts`
- `convex/zen/component/core/gateway.ts`
- `convex/zen/component/core/users.ts`
- `convex/zen/plugin/<plugin>.ts`
- `convex/zen/component/plugins/<plugin>/gateway.ts`
- `convex/zen/_generated/auth.ts`
- `convex/zen/_generated/meta.ts`
- `convex/zen/_generated/oauth.ts` _(only when OAuth is enabled)_

`convex/_generated/*` remains Convex-owned.

## CLI behavior

Command:

- `npx convex-zen generate`

Flags:

- `--cwd`
- `--check`
- `--verbose`

Behavior:

1. Read `convex/zen.config.ts`.
2. Detect enabled built-in plugins (currently admin).
3. Generate core + plugin wrappers.
4. Generate `convex/zen/_generated/meta.ts` by collecting plugin function kinds (`query|mutation|action`) from plugin wrapper files.
5. Print created/updated/deleted/unchanged summary.

## Runtime contract

- `createTanStackAuthServer({ convexFunctions: api.zen, pluginMeta: authPluginMeta })`
- `createTanStackAuthClient({ convexFunctions: api.zen, pluginMeta: authPluginMeta })`
- Auto route path: `/api/auth/plugin/<plugin>/<function>`
- Auto client path: `authClient.plugin.<plugin>.<function>()`

## Guardrails

- Generated-file marker required for overwrite/delete.
- `--check` exits non-zero when generated files drift.
- Clear runtime errors when metadata references missing plugin refs.

## Plugin feature checklist

When adding plugin features:

1. Add/update wrapper exports in `convex/zen/plugin/<plugin>.ts`.
2. Re-run `npx convex-zen generate` (refreshes `convex/zen/_generated/meta.ts`).
3. Re-run `npx convex codegen`.
4. Verify:
   - server route works at `/api/auth/plugin/<plugin>/<function>`
   - client method exists at `authClient.plugin.<plugin>.<function>()`.
