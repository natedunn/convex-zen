/* eslint-disable */
/**
 * Generated `ComponentApi` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type { FunctionReference } from "convex/server";

/**
 * A utility for referencing a Convex component's exposed API.
 *
 * Useful when expecting a parameter like `components.myComponent`.
 * Usage:
 * ```ts
 * async function myFunction(ctx: QueryCtx, component: ComponentApi) {
 *   return ctx.runQuery(component.someFile.someQuery, { ...args });
 * }
 * ```
 */
export type ComponentApi<Name extends string | undefined = string | undefined> =
  {
    gateway: {
      banUser: FunctionReference<
        "mutation",
        "internal",
        {
          actorUserId: string;
          adminRole?: string;
          expiresAt?: number;
          reason?: string;
          userId: string;
        },
        any,
        Name
      >;
      deleteUser: FunctionReference<
        "mutation",
        "internal",
        { actorUserId: string; adminRole?: string; userId: string },
        any,
        Name
      >;
      isAdmin: FunctionReference<
        "query",
        "internal",
        { actorUserId: string; adminRole?: string },
        any,
        Name
      >;
      listUsers: FunctionReference<
        "query",
        "internal",
        {
          actorUserId: string;
          adminRole?: string;
          cursor?: string;
          limit?: number;
        },
        any,
        Name
      >;
      setRole: FunctionReference<
        "mutation",
        "internal",
        {
          actorUserId: string;
          adminRole?: string;
          role: string;
          userId: string;
        },
        any,
        Name
      >;
      unbanUser: FunctionReference<
        "mutation",
        "internal",
        { actorUserId: string; adminRole?: string; userId: string },
        any,
        Name
      >;
    };
  };
