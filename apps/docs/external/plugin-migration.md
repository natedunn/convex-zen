# Plugin Migration

This release removes child-component plugins and moves plugin composition to build time.

## Built-in plugins

Replace:

```ts
import { systemAdminPlugin } from "convex-zen-system-admin";
import { organizationPlugin } from "convex-zen-organization";
```

With:

```ts
import { organizationPlugin, systemAdminPlugin } from "convex-zen/plugins";
```

Direct subpath imports like `convex-zen/plugins/system-admin` remain supported.

## Third-party plugins

- delete `convex/plugins/<pluginId>/convex.config.ts`
- move plugin tables into `schema.ts`
- export `definePluginSchema({ tables })`
- attach `schema` and `gateway` on the main factory export in `index.ts`

## Stable app-facing surface

These stay the same:

- `defineConvexZen({ plugins: [...] })`
- `auth.plugins.<pluginId>.*`
- `convex/zen/core.ts`
- `convex/zen/plugin/<pluginId>.ts`
- `convex/zen/_generated/meta.ts`
