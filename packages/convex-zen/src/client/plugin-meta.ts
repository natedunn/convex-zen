export type AuthPluginFunctionKind = "query" | "mutation" | "action";

export type AuthCoreMeta = Record<string, AuthPluginFunctionKind>;

export type AuthPluginMeta = Record<
  string,
  Record<string, AuthPluginFunctionKind>
>;

export interface AuthMeta {
  core: AuthCoreMeta;
  plugin: AuthPluginMeta;
}

export function toKebabCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[_\s]+/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();
}
