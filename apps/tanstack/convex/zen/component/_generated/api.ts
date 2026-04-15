/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as _runtime from "../_runtime.js";
import type * as example_gateway from "../example/gateway.js";
import type * as gateway from "../gateway.js";
import type * as organization_gateway from "../organization/gateway.js";
import type * as systemAdmin_gateway from "../systemAdmin/gateway.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import { anyApi, componentsGeneric } from "convex/server";

const fullApi: ApiFromModules<{
  _runtime: typeof _runtime;
  "example/gateway": typeof example_gateway;
  gateway: typeof gateway;
  "organization/gateway": typeof organization_gateway;
  "systemAdmin/gateway": typeof systemAdmin_gateway;
}> = anyApi as any;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
> = anyApi as any;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
> = anyApi as any;

export const components = componentsGeneric() as unknown as {
  core: import("convex-zen/core/_generated/component.js").ComponentApi<"core">;
  exampleComponent: import("convex-zen-example/_generated/component.js").ComponentApi<"exampleComponent">;
  systemAdminComponent: import("convex-zen-system-admin/_generated/component.js").ComponentApi<"systemAdminComponent">;
  organizationComponent: import("convex-zen-organization/_generated/component.js").ComponentApi<"organizationComponent">;
};
