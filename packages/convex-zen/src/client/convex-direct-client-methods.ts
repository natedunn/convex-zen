import type {
  FunctionArgs,
  FunctionReference,
  FunctionReturnType,
} from "convex/server";
import type {
  AuthCoreMeta,
  AuthMeta,
  AuthPluginFunctionKind,
  AuthPluginMeta,
} from "./plugin-meta";

export type DirectConvexFunctionKind = AuthPluginFunctionKind;
export type DirectConvexCoreMeta = AuthCoreMeta;
export type DirectConvexPluginMeta = AuthPluginMeta;
export type DirectConvexMeta = AuthMeta;

export type DirectConvexFunctionRef = FunctionReference<
  DirectConvexFunctionKind,
  "public"
>;

type Simplify<T> = { [K in keyof T]: T[K] } & {};

type DirectConvexMethod<TFunctionRef extends DirectConvexFunctionRef> = (
  input?: FunctionArgs<TFunctionRef>
) => Promise<FunctionReturnType<TFunctionRef>>;

type CoreFunctionsFromConvexFunctions<TConvexFunctions> =
  TConvexFunctions extends { core: infer TCore } ? TCore : TConvexFunctions;

type PluginFunctionsFromConvexFunctions<TConvexFunctions> =
  TConvexFunctions extends { plugin: infer TPlugin } ? TPlugin : {};

export type DirectConvexCoreExtensionsFromMeta<
  TConvexFunctions,
  TCoreMeta extends DirectConvexCoreMeta,
> = [keyof TCoreMeta] extends [never]
  ? {}
  : {
      core: {
        [TFunctionName in keyof TCoreMeta &
          keyof CoreFunctionsFromConvexFunctions<TConvexFunctions> &
          string as CoreFunctionsFromConvexFunctions<TConvexFunctions>[TFunctionName] extends DirectConvexFunctionRef
          ? TFunctionName
          : never]: CoreFunctionsFromConvexFunctions<TConvexFunctions>[TFunctionName] extends DirectConvexFunctionRef
          ? DirectConvexMethod<
              CoreFunctionsFromConvexFunctions<TConvexFunctions>[TFunctionName]
            >
          : never;
      };
    };

export type DirectConvexPluginExtensionsFromMeta<
  TConvexFunctions,
  TPluginMeta extends DirectConvexPluginMeta,
> = [keyof TPluginMeta] extends [never]
  ? {}
  : {
      plugin: {
        [TPluginName in keyof TPluginMeta &
          keyof PluginFunctionsFromConvexFunctions<TConvexFunctions> &
          string as PluginFunctionsFromConvexFunctions<TConvexFunctions>[TPluginName] extends Record<
          string,
          unknown
        >
          ? TPluginName
          : never]: PluginFunctionsFromConvexFunctions<TConvexFunctions>[TPluginName] extends Record<
          string,
          unknown
        >
          ? {
              [TFunctionName in keyof TPluginMeta[TPluginName] &
                keyof PluginFunctionsFromConvexFunctions<TConvexFunctions>[TPluginName] &
                string as PluginFunctionsFromConvexFunctions<TConvexFunctions>[TPluginName][TFunctionName] extends DirectConvexFunctionRef
                ? TFunctionName
                : never]: PluginFunctionsFromConvexFunctions<TConvexFunctions>[TPluginName][TFunctionName] extends DirectConvexFunctionRef
                ? DirectConvexMethod<
                    PluginFunctionsFromConvexFunctions<TConvexFunctions>[TPluginName][TFunctionName]
                  >
                : never;
            }
          : never;
      };
    };

export type DirectConvexRootAliasExtensionsFromMeta<
  TConvexFunctions,
  TCoreMeta extends DirectConvexCoreMeta,
  TReservedName extends string,
> = [keyof TCoreMeta] extends [never]
  ? {}
  : Simplify<{
      [TFunctionName in keyof TCoreMeta &
        keyof CoreFunctionsFromConvexFunctions<TConvexFunctions> &
        string as CoreFunctionsFromConvexFunctions<TConvexFunctions>[TFunctionName] extends DirectConvexFunctionRef
        ? TFunctionName extends TReservedName
          ? never
          : TFunctionName
        : never]: CoreFunctionsFromConvexFunctions<TConvexFunctions>[TFunctionName] extends DirectConvexFunctionRef
        ? DirectConvexMethod<
            CoreFunctionsFromConvexFunctions<TConvexFunctions>[TFunctionName]
          >
        : never;
    }>;

export function readMember(value: unknown, key: string): unknown {
  if (!value || (typeof value !== "object" && typeof value !== "function")) {
    return undefined;
  }
  return (value as Record<string, unknown>)[key];
}

export function hasFunctionRefCandidate(
  value: unknown
): value is DirectConvexFunctionRef {
  return !!value && (typeof value === "object" || typeof value === "function");
}

export function hasPluginFunctionRefs(convexFunctions: Record<string, unknown>): boolean {
  const pluginValue = readMember(convexFunctions, "plugin");
  if (!pluginValue || typeof pluginValue !== "object") {
    return false;
  }

  for (const pluginFunctions of Object.values(
    pluginValue as Record<string, unknown>
  )) {
    if (!pluginFunctions || typeof pluginFunctions !== "object") {
      continue;
    }
    for (const functionRef of Object.values(
      pluginFunctions as Record<string, unknown>
    )) {
      if (hasFunctionRefCandidate(functionRef)) {
        return true;
      }
    }
  }

  return false;
}

function resolveCoreFunctionRoot(convexFunctions: Record<string, unknown>): unknown {
  const nestedCore = readMember(convexFunctions, "core");
  if (nestedCore && (typeof nestedCore === "object" || typeof nestedCore === "function")) {
    return nestedCore;
  }
  return convexFunctions;
}

function resolveCoreFunctionRef(
  convexFunctions: Record<string, unknown>,
  functionName: string
): unknown {
  const coreRoot = resolveCoreFunctionRoot(convexFunctions);
  return readMember(coreRoot, functionName);
}

type DirectMethodFactory = (
  kind: DirectConvexFunctionKind,
  functionRef: DirectConvexFunctionRef,
  path: string
) => unknown;

export interface BuildDirectConvexClientExtensionsOptions {
  clientName: string;
  convexFunctions?: Record<string, unknown>;
  coreMeta?: DirectConvexCoreMeta;
  pluginMeta?: DirectConvexPluginMeta;
  reservedCoreRootMethodNames: ReadonlySet<string>;
  existingRootNames?: ReadonlySet<string>;
  createMethod: DirectMethodFactory;
}

export function buildDirectConvexClientExtensions(
  options: BuildDirectConvexClientExtensionsOptions
): Record<string, unknown> {
  const convexFunctions = options.convexFunctions;
  if (!convexFunctions) {
    return {};
  }

  if (hasPluginFunctionRefs(convexFunctions) && options.pluginMeta === undefined) {
    throw new Error(
      `${options.clientName} requires "pluginMeta" when convexFunctions.plugin is provided. ` +
        "Pass generated authMeta/authPluginMeta (convex/auth/generated.ts)."
    );
  }

  const extension: Record<string, unknown> = {};

  if (options.pluginMeta) {
    const pluginRoot = readMember(convexFunctions, "plugin");
    const pluginExtension: Record<string, unknown> = {};

    for (const [pluginName, functions] of Object.entries(options.pluginMeta)) {
      const pluginFunctions = readMember(pluginRoot, pluginName);
      const clientFunctions: Record<string, unknown> = {};

      for (const [functionName, functionKind] of Object.entries(functions)) {
        const functionRef = readMember(pluginFunctions, functionName);
        if (!hasFunctionRefCandidate(functionRef)) {
          throw new Error(
            `${options.clientName} could not resolve "convexFunctions.plugin.${pluginName}.${functionName}".`
          );
        }
        clientFunctions[functionName] = options.createMethod(
          functionKind,
          functionRef,
          `plugin.${pluginName}.${functionName}`
        );
      }

      if (Object.keys(clientFunctions).length > 0) {
        pluginExtension[pluginName] = clientFunctions;
      }
    }

    if (Object.keys(pluginExtension).length > 0) {
      extension.plugin = pluginExtension;
    }
  }

  if (options.coreMeta) {
    const coreExtension: Record<string, unknown> = {};

    for (const [functionName, functionKind] of Object.entries(options.coreMeta)) {
      const functionRef = resolveCoreFunctionRef(convexFunctions, functionName);
      if (!hasFunctionRefCandidate(functionRef)) {
        throw new Error(
          `${options.clientName} could not resolve "${functionName}" in convexFunctions. ` +
            `Pass flat convexFunctions ({ ${functionName}, ... }) or nested convexFunctions ({ core: { ${functionName}, ... } }).`
        );
      }
      coreExtension[functionName] = options.createMethod(
        functionKind,
        functionRef,
        `core.${functionName}`
      );
    }

    if (Object.keys(coreExtension).length > 0) {
      extension.core = coreExtension;
      for (const [functionName, method] of Object.entries(coreExtension)) {
        const isReserved = options.reservedCoreRootMethodNames.has(functionName);
        const alreadyExists = options.existingRootNames?.has(functionName) ?? false;
        if (isReserved || alreadyExists) {
          const reason = isReserved
            ? "is a reserved authClient key"
            : "already exists on authClient";
          throw new Error(
            `${options.clientName} could not alias "core.${functionName}" at authClient root because "${functionName}" ${reason}. ` +
              "Rename the core function to avoid conflicts."
          );
        }
        extension[functionName] = method;
      }
    }
  }

  return extension;
}
