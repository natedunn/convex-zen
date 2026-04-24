# Flat Build-Time Plugins

`convex-zen` now compiles enabled plugins into one generated Zen component.

## Built-in imports

```ts
import { systemAdminPlugin } from "convex-zen/plugins/system-admin";
import { organizationPlugin } from "convex-zen/plugins/organization";
```

## Third-party layout

```text
convex/
  plugins/
    custom/
      index.ts
      schema.ts
      gateway.ts
      runtime.ts   # optional
  zen.config.ts
```

## Contract

- `index.ts` calls `definePlugin({ id, gateway, schema, normalizeOptions, optionsSchema, extendRuntime, hooks })`
- `schema.ts` exports `definePluginSchema({ tables })`
- `gateway.ts` is the source of truth for public plugin functions and metadata
- plugin-owned tables must be prefixed with `pluginId__`
- plugins no longer define `convex.config.ts`

## Generated output

Running `npx convex-zen generate` produces:

- `convex/zen/component/convex.config.ts`
- `convex/zen/component/schema.ts`
- `convex/zen/component/_runtime.ts`
- `convex/zen/component/core/gateway.ts`
- `convex/zen/component/core/users.ts`
- `convex/zen/component/plugins/<pluginId>/gateway.ts`
- `convex/zen/core.ts`
- `convex/zen/plugin/<pluginId>.ts`
- `convex/zen/_generated/meta.ts`
