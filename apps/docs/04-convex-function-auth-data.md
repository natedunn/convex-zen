# 04 - Auth Data on Convex Functions Side

## Identity model

- Convex function auth is from `ctx.auth`.
- Component gateway calls receive `actorUserId` derived from identity.

Convex components do not read `ctx.auth` directly, so host functions bridge identity into gateway calls.

## Generated plugin surface

With `npx convex-zen generate`:

- core wrappers: `convex/auth/core.ts`
- plugin wrappers: `convex/auth/plugin/<plugin>.ts`
- plugin kind metadata: `convex/auth/plugin/metaGenerated.ts`

`metaGenerated.ts` is consumed by TanStack auth server/client auto mode.

## TanStack flow

- `src/lib/auth-server.ts` passes `api.auth` + `authPluginMeta` into `createTanStackAuthServer`.
- `src/lib/auth-client.ts` passes `api.auth` + `authPluginMeta` into `createTanStackAuthClient`.
- Plugin calls use:
  - route: `/api/auth/plugin/<plugin>/<function>`
  - client: `authClient.plugin.<plugin>.<function>(args)`

## Safety

- Importing `api.auth` into client code is acceptable (function refs only, no secrets).
- Authorization remains enforced in Convex functions, not in route naming.
