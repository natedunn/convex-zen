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

export function hasPluginFunctionRefs(convexFunctions: Record<string, unknown>): boolean {
  const pluginFunctions = readMember(convexFunctions, "plugin");
  if (
    !pluginFunctions ||
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
