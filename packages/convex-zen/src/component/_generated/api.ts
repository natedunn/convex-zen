/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as core_sessions from "../core/sessions.js";
import type * as core_users from "../core/users.js";
import type * as core_verifications from "../core/verifications.js";
import type * as gateway from "../gateway.js";
import type * as lib_crypto from "../lib/crypto.js";
import type * as lib_rateLimit from "../lib/rateLimit.js";
import type * as plugins_admin from "../plugins/admin.js";
import type * as providers_emailPassword from "../providers/emailPassword.js";
import type * as providers_oauth from "../providers/oauth.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import { anyApi, componentsGeneric } from "convex/server";

const fullApi: ApiFromModules<{
  "core/sessions": typeof core_sessions;
  "core/users": typeof core_users;
  "core/verifications": typeof core_verifications;
  gateway: typeof gateway;
  "lib/crypto": typeof lib_crypto;
  "lib/rateLimit": typeof lib_rateLimit;
  "plugins/admin": typeof plugins_admin;
  "providers/emailPassword": typeof providers_emailPassword;
  "providers/oauth": typeof providers_oauth;
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

export const components = componentsGeneric() as unknown as {};
