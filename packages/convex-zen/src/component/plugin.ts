import {
  actionGeneric,
  type ActionBuilder,
  type GenericActionCtx,
  type GenericDataModel,
  type GenericMutationCtx,
  type GenericQueryCtx,
  type MutationBuilder,
  type QueryBuilder,
  type RegisteredAction,
  type RegisteredMutation,
  type RegisteredQuery,
  mutationGeneric,
  queryGeneric,
} from "convex/server";
import {
  v,
  type ObjectType,
  type PropertyValidators,
  type Validator,
} from "convex/values";
import {
  PLUGIN_FUNCTION_METADATA_KEY,
  type PluginFunctionCarrier,
  type PluginFunctionMetadata,
  type PluginGatewayFieldConfig,
} from "../types.js";
import type {
  AuthPluginFunctionAuth,
  AuthPluginFunctionKind,
  PluginGatewayModule,
  PluginGatewayRuntimeMethods,
} from "../types.js";

type PluginHandlerArgs<
  TArgs extends PropertyValidators,
  TAuth extends AuthPluginFunctionAuth,
  TActor extends PluginGatewayFieldConfig | undefined,
> = RegisteredPluginArgs<TArgs, TAuth, TActor>;

type PluginActorValidators<
  TAuth extends AuthPluginFunctionAuth,
  TActor extends PluginGatewayFieldConfig | undefined,
> = TAuth extends "actor" | "optionalActor"
  ? {
      actorUserId: Validator<string, "required", never>;
    } & (TActor extends { actorEmail: true }
      ? {
          actorEmail: Validator<string | undefined, "optional", never>;
        }
      : {})
  : {};

type RegisteredPluginValidators<
  TArgs extends PropertyValidators,
  TAuth extends AuthPluginFunctionAuth,
  TActor extends PluginGatewayFieldConfig | undefined,
> = TArgs & PluginActorValidators<TAuth, TActor>;

type RegisteredPluginArgs<
  TArgs extends PropertyValidators,
  TAuth extends AuthPluginFunctionAuth,
  TActor extends PluginGatewayFieldConfig | undefined,
> = ObjectType<RegisteredPluginValidators<TArgs, TAuth, TActor>>;

type PluginQueryDefinition<
  TDataModel extends GenericDataModel,
  TArgs extends PropertyValidators,
  TAuth extends AuthPluginFunctionAuth,
  TActor extends PluginGatewayFieldConfig | undefined,
  TReturn,
> = {
  auth: TAuth;
  args: TArgs;
  actor?: TActor;
  handler: (
    ctx: GenericQueryCtx<TDataModel>,
    args: PluginHandlerArgs<TArgs, TAuth, TActor>
  ) => TReturn;
};

type PluginMutationDefinition<
  TDataModel extends GenericDataModel,
  TArgs extends PropertyValidators,
  TAuth extends AuthPluginFunctionAuth,
  TActor extends PluginGatewayFieldConfig | undefined,
  TReturn,
> = {
  auth: TAuth;
  args: TArgs;
  actor?: TActor;
  handler: (
    ctx: GenericMutationCtx<TDataModel>,
    args: PluginHandlerArgs<TArgs, TAuth, TActor>
  ) => TReturn;
};

type PluginActionDefinition<
  TDataModel extends GenericDataModel,
  TArgs extends PropertyValidators,
  TAuth extends AuthPluginFunctionAuth,
  TActor extends PluginGatewayFieldConfig | undefined,
  TReturn,
> = {
  auth: TAuth;
  args: TArgs;
  actor?: TActor;
  handler: (
    ctx: GenericActionCtx<TDataModel>,
    args: PluginHandlerArgs<TArgs, TAuth, TActor>
  ) => TReturn;
};

type PluginMetadataCarrier<
  TKind extends AuthPluginFunctionKind,
  TAuth extends AuthPluginFunctionAuth,
  TArgs extends PropertyValidators,
  TActor extends PluginGatewayFieldConfig | undefined,
> = PluginFunctionCarrier<
  {
    kind: TKind;
    auth: TAuth;
    args: TArgs;
    actor?: TActor | undefined;
  }
>;

type OmitValidatorFields<
  TArgs extends PropertyValidators,
  TKeys extends PropertyKey,
> = {
  [TKey in keyof TArgs as TKey extends TKeys ? never : TKey]: TArgs[TKey];
};

type PublicPluginFunctionValidators<TValue> =
  TValue extends PluginFunctionCarrier<infer TMetadata>
    ? TMetadata extends {
        args: infer TArgs extends PropertyValidators;
        auth: infer TAuth extends AuthPluginFunctionAuth;
        actor?: infer TActor;
      }
      ? TAuth extends "actor" | "optionalActor"
        ? OmitValidatorFields<
            TArgs,
            "actorUserId" | (TActor extends { actorEmail: true } ? "actorEmail" : never)
          >
        : TArgs
      : never
    : never;

type PluginRegisteredQuery<
  TArgs extends PropertyValidators,
  TAuth extends AuthPluginFunctionAuth,
  TActor extends PluginGatewayFieldConfig | undefined,
  TReturn,
> = RegisteredQuery<"public", RegisteredPluginArgs<TArgs, TAuth, TActor>, TReturn> &
  PluginMetadataCarrier<"query", TAuth, TArgs, TActor>;

type PluginRegisteredMutation<
  TArgs extends PropertyValidators,
  TAuth extends AuthPluginFunctionAuth,
  TActor extends PluginGatewayFieldConfig | undefined,
  TReturn,
> = RegisteredMutation<
  "public",
  RegisteredPluginArgs<TArgs, TAuth, TActor>,
  TReturn
> &
  PluginMetadataCarrier<"mutation", TAuth, TArgs, TActor>;

type PluginRegisteredAction<
  TArgs extends PropertyValidators,
  TAuth extends AuthPluginFunctionAuth,
  TActor extends PluginGatewayFieldConfig | undefined,
  TReturn,
> = RegisteredAction<
  "public",
  RegisteredPluginArgs<TArgs, TAuth, TActor>,
  TReturn
> &
  PluginMetadataCarrier<"action", TAuth, TArgs, TActor>;

function buildRegisteredArgs<
  TArgs extends PropertyValidators,
  TAuth extends AuthPluginFunctionAuth,
  TActor extends PluginGatewayFieldConfig | undefined,
>(
  args: TArgs,
  auth: TAuth,
  actor: TActor
): RegisteredPluginValidators<TArgs, TAuth, TActor> {
  if (auth !== "actor" && auth !== "optionalActor") {
    return args as RegisteredPluginValidators<TArgs, TAuth, TActor>;
  }
  return {
    ...args,
    actorUserId: v.string(),
    ...(actor?.actorEmail ? { actorEmail: v.optional(v.string()) } : {}),
  } as RegisteredPluginValidators<TArgs, TAuth, TActor>;
}

function attachPluginMetadata<
  TValue extends object,
  TMetadata extends PluginFunctionMetadata,
>(
  value: TValue,
  metadata: TMetadata
): TValue & { [PLUGIN_FUNCTION_METADATA_KEY]: TMetadata } {
  Object.defineProperty(value, PLUGIN_FUNCTION_METADATA_KEY, {
    value: metadata,
    enumerable: false,
    configurable: false,
    writable: false,
  });
  return value as TValue & { [PLUGIN_FUNCTION_METADATA_KEY]: TMetadata };
}

function getQueryBuilder<TDataModel extends GenericDataModel>() {
  return queryGeneric as QueryBuilder<TDataModel, "public">;
}

function getMutationBuilder<TDataModel extends GenericDataModel>() {
  return mutationGeneric as MutationBuilder<TDataModel, "public">;
}

function getActionBuilder<TDataModel extends GenericDataModel>() {
  return actionGeneric as ActionBuilder<TDataModel, "public">;
}

export function pluginQuery<
  TDataModel extends GenericDataModel = GenericDataModel,
  TArgs extends PropertyValidators = PropertyValidators,
  TAuth extends AuthPluginFunctionAuth = AuthPluginFunctionAuth,
  TActor extends PluginGatewayFieldConfig | undefined = undefined,
  TReturn = unknown,
>(
  definition: PluginQueryDefinition<TDataModel, TArgs, TAuth, TActor, TReturn>
): PluginRegisteredQuery<TArgs, TAuth, TActor, TReturn> {
  const query = getQueryBuilder<TDataModel>();
  return attachPluginMetadata(
    query({
      args: buildRegisteredArgs(
        definition.args,
        definition.auth,
        definition.actor
      ),
      handler: (ctx, args) => definition.handler(ctx, args),
    }),
    {
      kind: "query",
      auth: definition.auth,
      args: definition.args,
      ...(definition.actor ? { actor: definition.actor } : {}),
    }
  );
}

export function pluginMutation<
  TDataModel extends GenericDataModel = GenericDataModel,
  TArgs extends PropertyValidators = PropertyValidators,
  TAuth extends AuthPluginFunctionAuth = AuthPluginFunctionAuth,
  TActor extends PluginGatewayFieldConfig | undefined = undefined,
  TReturn = unknown,
>(
  definition: PluginMutationDefinition<TDataModel, TArgs, TAuth, TActor, TReturn>
): PluginRegisteredMutation<TArgs, TAuth, TActor, TReturn> {
  const mutation = getMutationBuilder<TDataModel>();
  return attachPluginMetadata(
    mutation({
      args: buildRegisteredArgs(
        definition.args,
        definition.auth,
        definition.actor
      ),
      handler: (ctx, args) => definition.handler(ctx, args),
    }),
    {
      kind: "mutation",
      auth: definition.auth,
      args: definition.args,
      ...(definition.actor ? { actor: definition.actor } : {}),
    }
  );
}

export function pluginAction<
  TDataModel extends GenericDataModel = GenericDataModel,
  TArgs extends PropertyValidators = PropertyValidators,
  TAuth extends AuthPluginFunctionAuth = AuthPluginFunctionAuth,
  TActor extends PluginGatewayFieldConfig | undefined = undefined,
  TReturn = unknown,
>(
  definition: PluginActionDefinition<TDataModel, TArgs, TAuth, TActor, TReturn>
): PluginRegisteredAction<TArgs, TAuth, TActor, TReturn> {
  const action = getActionBuilder<TDataModel>();
  return attachPluginMetadata(
    action({
      args: buildRegisteredArgs(
        definition.args,
        definition.auth,
        definition.actor
      ),
      handler: (ctx, args) => definition.handler(ctx, args),
    }),
    {
      kind: "action",
      auth: definition.auth,
      args: definition.args,
      ...(definition.actor ? { actor: definition.actor } : {}),
    }
  );
}

export function getPluginFunctionMetadata(
  value: unknown,
  exportName: string
): PluginFunctionMetadata {
  const metadata = (value as PluginFunctionCarrier | null)?.[
    PLUGIN_FUNCTION_METADATA_KEY
  ];
  if (!metadata) {
    throw new Error(
      `Plugin gateway export "${exportName}" is missing convex-zen plugin metadata. ` +
        `Use pluginQuery/pluginMutation/pluginAction for public plugin functions.`
    );
  }
  return metadata;
}

export function getPublicPluginFunctionArgs<TValue>(
  value: TValue,
  exportName: string
): PublicPluginFunctionValidators<TValue> {
  const metadata = getPluginFunctionMetadata(value, exportName);
  const publicArgs = { ...metadata.args };
  if (metadata.auth === "actor" || metadata.auth === "optionalActor") {
    delete publicArgs.actorUserId;
    if (metadata.actor?.actorEmail) {
      delete publicArgs.actorEmail;
    }
  }
  return publicArgs as PublicPluginFunctionValidators<TValue>;
}

export function collectPluginGatewayMetadata(
  gateway: PluginGatewayModule
): PluginGatewayRuntimeMethods {
  const entries: PluginGatewayRuntimeMethods = {};
  for (const [exportName, value] of Object.entries(gateway)) {
    if (!value || (typeof value !== "object" && typeof value !== "function")) {
      continue;
    }
    const metadata = (value as PluginFunctionCarrier)[PLUGIN_FUNCTION_METADATA_KEY];
    if (!metadata) {
      continue;
    }
    entries[exportName] = metadata;
  }
  return entries;
}

export { PLUGIN_FUNCTION_METADATA_KEY };
