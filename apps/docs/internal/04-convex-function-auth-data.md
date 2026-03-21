# 04 - Auth Data on Convex Functions Side

## Identity model

- Convex function auth is from `ctx.auth`.
- Component gateway calls receive `actorUserId` derived from identity.

Convex components do not read `ctx.auth` directly, so host functions bridge identity into gateway calls.

## Generated plugin surface

With `npx convex-zen generate`:

- core wrappers: `convex/zen/core.ts`
- plugin wrappers: `convex/zen/plugin/<plugin>.ts`
- auth helper: `convex/zen/_generated/auth.ts`
- plugin kind metadata: `convex/zen/_generated/meta.ts`

`convex/zen/_generated/meta.ts` is consumed by TanStack auth server/client auto mode.

## TanStack flow

- `src/lib/auth-server.ts` passes `api.zen` + `authPluginMeta` into `createTanStackAuthServer`.
- `src/lib/auth-client.ts` passes `api.zen` + `authPluginMeta` into `createTanStackAuthClient`.
- Plugin calls use:
  - route: `/api/auth/plugin/<plugin>/<function>`
  - client: `authClient.plugin.<plugin>.<function>(args)`

## Safety

- Importing `api.zen` into client code is acceptable (function refs only, no secrets).
- Authorization remains enforced in Convex functions, not in route naming.
