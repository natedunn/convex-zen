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
      adminBanUser: FunctionReference<
        "action",
        "internal",
        { expiresAt?: number; reason?: string; userId: string },
        any,
        Name
      >;
      adminDeleteUser: FunctionReference<
        "action",
        "internal",
        { userId: string },
        any,
        Name
      >;
      adminListUsers: FunctionReference<
        "action",
        "internal",
        { cursor?: string; limit?: number },
        any,
        Name
      >;
      adminSetRole: FunctionReference<
        "action",
        "internal",
        { role: string; userId: string },
        any,
        Name
      >;
      adminUnbanUser: FunctionReference<
        "action",
        "internal",
        { userId: string },
        any,
        Name
      >;
      getAuthorizationUrl: FunctionReference<
        "action",
        "internal",
        { provider: any; redirectUrl?: string },
        any,
        Name
      >;
      handleCallback: FunctionReference<
        "action",
        "internal",
        {
          code: string;
          ipAddress?: string;
          provider: any;
          redirectUrl?: string;
          state: string;
          userAgent?: string;
        },
        any,
        Name
      >;
      invalidateAllSessions: FunctionReference<
        "action",
        "internal",
        { userId: string },
        any,
        Name
      >;
      invalidateSession: FunctionReference<
        "action",
        "internal",
        { token: string },
        any,
        Name
      >;
      requestPasswordReset: FunctionReference<
        "action",
        "internal",
        { email: string; ipAddress?: string },
        any,
        Name
      >;
      resetPassword: FunctionReference<
        "action",
        "internal",
        { code: string; email: string; newPassword: string },
        any,
        Name
      >;
      signIn: FunctionReference<
        "action",
        "internal",
        {
          email: string;
          ipAddress?: string;
          password: string;
          requireEmailVerified?: boolean;
          userAgent?: string;
        },
        any,
        Name
      >;
      signUp: FunctionReference<
        "action",
        "internal",
        { email: string; ipAddress?: string; name?: string; password: string },
        any,
        Name
      >;
      validateSession: FunctionReference<
        "action",
        "internal",
        { checkBanned?: boolean; token: string },
        any,
        Name
      >;
      verifyEmail: FunctionReference<
        "action",
        "internal",
        { code: string; email: string },
        any,
        Name
      >;
    };
  };
