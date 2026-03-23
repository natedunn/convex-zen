import type { FunctionReference } from "convex/server";

export type ConvexRouteFunctionRef = FunctionReference<
  "query" | "mutation" | "action",
  "public"
>;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function hasFunctionRefCandidate(value: unknown): boolean {
  return (
    value !== null &&
    (typeof value === "object" || typeof value === "function")
  );
}

export function readMember(source: unknown, key: string): unknown {
  if (
    source === null ||
    (typeof source !== "object" && typeof source !== "function")
  ) {
    return undefined;
  }
  return (source as Record<string, unknown>)[key];
}

export function readFunctionRef<T extends ConvexRouteFunctionRef>(value: unknown): T | null {
  if (!value || (typeof value !== "object" && typeof value !== "function")) {
    return null;
  }
  return value as T;
}

export function hasPluginFunctionRefs(convexFunctions: unknown): boolean {
  const pluginFunctions = readMember(convexFunctions, "plugin");
  if (
    pluginFunctions == null ||
    (typeof pluginFunctions !== "object" && typeof pluginFunctions !== "function")
  ) {
    return false;
  }

  for (const pluginFunctionsValue of Object.values(
    pluginFunctions as Record<string, unknown>
  )) {
    if (
      !pluginFunctionsValue ||
      (typeof pluginFunctionsValue !== "object" &&
        typeof pluginFunctionsValue !== "function")
    ) {
      continue;
    }
    for (const functionRef of Object.values(
      pluginFunctionsValue as Record<string, unknown>
    )) {
      if (hasFunctionRefCandidate(functionRef)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Resolve a Convex component function reference from a dotted path string.
 *
 * Converts e.g. `"gateway:signUp"` or `"system-admin/gateway:listUsers"` into the
 * corresponding nested property on the component API object.
 *
 * Used by ConvexZen, SystemAdminPlugin, and OrganizationPlugin to avoid duplicating
 * the same traversal logic.
 */
export function resolveComponentFn(
  api: Record<string, unknown>,
  path: string,
): unknown {
  const [modulePath, funcName] = path.split(":");
  if (!modulePath || !funcName) {
    throw new Error(`Invalid function path: ${path}`);
  }
  const parts = modulePath.split("/");
  let ref: Record<string, unknown> = api;
  for (const part of parts) {
    const next = ref[part];
    if (!next || typeof next !== "object" || Array.isArray(next)) {
      throw new Error(`Invalid function path segment: ${part}`);
    }
    ref = next as Record<string, unknown>;
  }
  const resolved = ref[funcName];
  if (!resolved) {
    throw new Error(`Function not found: ${path}`);
  }
  return resolved;
}
