export type TanStackAuthPluginFunctionKind = "query" | "mutation" | "action";

export type TanStackAuthPluginMeta = Record<
  string,
  Record<string, TanStackAuthPluginFunctionKind>
>;

export function toKebabCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[_\s]+/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();
}
