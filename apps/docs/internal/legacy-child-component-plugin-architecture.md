# Legacy Child-Component Plugin Architecture

This note documents the pre-flat-plugin model kept for historical context.

## Old model

- Zen mounted built-in and third-party plugins as child Convex components
- plugin packages shipped their own `convex.config.ts`
- the generator emitted `.use(...)` calls in `convex/zen/component/convex.config.ts`
- runtime extension context exposed child-component details such as `childName`
- plugin calls could hop through child component paths like `<plugin>/gateway:<fn>`

## Why it was removed

- generated code had extra mount-time indirection
- plugin tables lived outside one merged schema source of truth
- child component path resolution complicated runtime helpers and testing
- built-in plugins required separate packages even when unused

## Replacement

The current architecture compiles enabled plugins into one Zen component at build time.
See `../external/flat-buildtime-plugins.md` for the active contract.
