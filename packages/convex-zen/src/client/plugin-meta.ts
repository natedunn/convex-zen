import type { OAuthProxyReturnTargetRule } from "../types.js";

export type AuthPluginFunctionKind = "query" | "mutation" | "action";

export type AuthCoreMeta = Record<string, AuthPluginFunctionKind>;

export type AuthPluginMeta = Record<
  string,
  Record<string, AuthPluginFunctionKind>
>;

export interface AuthConfigMeta {
  oauthProxy?: {
    allowedReturnTargets?: readonly OAuthProxyReturnTargetRule[];
  };
}

export interface AuthMeta {
  core: AuthCoreMeta;
  plugin: AuthPluginMeta;
  config?: AuthConfigMeta;
}

export function toKebabCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[_\s]+/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();
}
