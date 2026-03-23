# Plugin Authoring

The plugin API is now gateway-first:

- you define public plugin methods once, in `gateway.ts`
- `convex-zen` reads those gateway exports and generates the same wrapper output as before
- runtime methods are created automatically from the gateway
- custom runtime helpers are optional

If you want a minimal reference implementation, look at the example plugin package in this repo:

- `packages/convex-zen-example`

## Standard layout

Author plugins under `convex/plugins/<pluginId>/`:

```text
convex/
  plugins/
    custom/
      convex.config.ts
      schema.ts        # optional
      gateway.ts
      index.ts
      runtime.ts       # optional
  zen.config.ts
```

## What lives where

- `convex.config.ts`: the Convex component for the plugin
- `schema.ts`: plugin-owned tables, if the plugin stores data
- `gateway.ts`: the single source of truth for public plugin functions
- `index.ts`: exports the plugin with `definePlugin(...)`
- `runtime.ts`: optional higher-level helpers layered on top of generated gateway methods

## 1. Define the plugin component

`convex/plugins/custom/convex.config.ts`

```ts
import { defineComponent } from "convex/server";

const custom = defineComponent("custom");

export default custom;
```

## 2. Define public gateway methods

`convex/plugins/custom/gateway.ts`

```ts
import { v } from "convex/values";
import { pluginMutation, pluginQuery } from "convex-zen/component";

export const getMessage = pluginQuery({
  auth: "public",
  args: {},
  handler: async () => {
    return "hello";
  },
});

export const setMessage = pluginMutation({
  auth: "actor",
  args: {
    message: v.string(),
  },
  handler: async (_ctx, { actorUserId, message }) => {
    return { ok: true, actorUserId, message };
  },
});
```

Important details:

- use `pluginQuery`, `pluginMutation`, or `pluginAction`
- `auth` controls how `convex-zen` injects identity
- gateway exports are the only source of truth for generated wrappers and runtime methods

## `auth` modes

- `public`: args pass through unchanged
- `actor`: generated runtime requires identity and injects `actorUserId` into the handler's args automatically
- `optionalActor`: generated runtime attempts identity and returns `false` when no actor exists

**Actor fields are injected automatically** — you do not need to add `actorUserId` to `args`. Define only the *public* args your function needs; convex-zen will inject the actor fields at runtime so the handler can access them.

If the handler also needs the actor's email, add `actor: { actorEmail: true }` to the function definition. This tells convex-zen to inject `actorEmail` as well:

```ts
export const setMessageWithEmail = pluginMutation({
  auth: "actor",
  actor: { actorEmail: true },
  args: {
    message: v.string(),
  },
  handler: async (_ctx, { actorUserId, actorEmail, message }) => {
    return { ok: true, actorUserId, actorEmail, message };
  },
});
```

## 3. Export the plugin

`convex/plugins/custom/index.ts`

```ts
import { definePlugin } from "convex-zen";
import * as gateway from "./gateway";

export const customPlugin = definePlugin({
  id: "custom",
  gateway,
});
```

That is enough for most plugins.

## 4. Optional runtime helpers

Gateway methods are automatically exposed at:

- `auth.plugins.custom.getMessage(ctx, args)`
- `auth.plugins.custom.setMessage(ctx, args)`

If you want extra helpers on top of those generated methods, use `extendRuntime`.

`convex/plugins/custom/index.ts`

```ts
import { definePlugin } from "convex-zen";
import * as gateway from "./gateway";

export const customPlugin = definePlugin({
  id: "custom",
  gateway,
  extendRuntime: ({ gateway }) => ({
    async rename(ctx: unknown, message: string) {
      return gateway.setMessage(ctx, { message });
    },
  }),
});
```

Rules:

- generated gateway methods are always present
- `extendRuntime` is additive only
- custom helpers must not reuse a generated gateway method name

## 5. Plugin schema

Plugin schema lives next to the plugin component:

`convex/plugins/custom/schema.ts`

```ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  customMessages: defineTable({
    message: v.string(),
  }),
});
```

`definePlugin(...)` does not define schema. The plugin component owns schema.

## 6. Enable the plugin

`convex/zen.config.ts`

```ts
import { defineConvexZen } from "convex-zen";
import { customPlugin } from "./plugins/custom";

const zenConfig = defineConvexZen({
  plugins: [customPlugin()],
});

export default zenConfig;
```

## 7. Generate wrappers

```bash
npx convex-zen generate
npx convex codegen
```

This still generates the same output surface:

- `convex/zen/plugin/custom.ts`
- `convex/zen/component/custom/gateway.ts`
- `convex/zen/_generated/meta.ts`

## What gets generated

From the gateway exports, `convex-zen` generates:

- Convex wrappers under `convex/zen/plugin/<plugin>.ts`
- component gateway wrappers under `convex/zen/component/<plugin>/gateway.ts`
- adapter metadata in `convex/zen/_generated/meta.ts`
- runtime methods under `auth.plugins.<pluginId>.<functionName>`

That means the same plugin can be reached through:

- Convex wrappers: `api.zen.plugin.custom.getMessage`
- adapter routes: `/api/auth/plugin/custom/get-message`
- client helpers: `authClient.plugin.custom.getMessage(...)`

## Checklist

When a plugin is not showing up correctly, check these first:

1. `gateway.ts` exports use `pluginQuery` / `pluginMutation` / `pluginAction`
2. `index.ts` exports `definePlugin({ id, gateway })`
3. the plugin is enabled in `convex/zen.config.ts`
4. `convex/plugins/<pluginId>/convex.config.ts` exists
5. `npx convex-zen generate` and `npx convex codegen` have both been re-run
