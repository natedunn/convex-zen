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
      adminDeleteUser: FunctionReference<
        "mutation",
        "internal",
        { actorUserId: string; adminRole?: string; userId: string },
        any,
        Name
      >;
      adminIsAdmin: FunctionReference<
        "query",
        "internal",
        { actorUserId: string; adminRole?: string },
        any,
        Name
      >;
      adminListUsers: FunctionReference<
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
      adminSetRole: FunctionReference<
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
      adminUnbanUser: FunctionReference<
        "mutation",
        "internal",
        { actorUserId: string; adminRole?: string; userId: string },
        any,
        Name
      >;
      getAuthorizationUrl: FunctionReference<
        "action",
        "internal",
        {
          provider: {
            authorizationUrl: string;
            clientId: string;
            clientSecret: string;
            id: string;
            scopes: Array<string>;
            tokenEncryptionSecret?: string;
            tokenUrl: string;
            userInfoUrl: string;
          };
          redirectUrl?: string;
        },
        any,
        Name
      >;
      getCurrentUser: FunctionReference<
        "mutation",
        "internal",
        { checkBanned?: boolean; token: string },
        any,
        Name
      >;
      getUserById: FunctionReference<
        "mutation",
        "internal",
        { checkBanned?: boolean; userId: string },
        any,
        Name
      >;
      handleCallback: FunctionReference<
        "action",
        "internal",
        {
          code: string;
          defaultRole?: string;
          ipAddress?: string;
          provider: {
            authorizationUrl: string;
            clientId: string;
            clientSecret: string;
            id: string;
            scopes: Array<string>;
            tokenEncryptionSecret?: string;
            tokenUrl: string;
            userInfoUrl: string;
          };
          redirectUrl?: string;
          state: string;
          userAgent?: string;
        },
        any,
        Name
      >;
      invalidateAllSessions: FunctionReference<
        "mutation",
        "internal",
        { userId: string },
        any,
        Name
      >;
      invalidateSession: FunctionReference<
        "mutation",
        "internal",
        { token: string },
        any,
        Name
      >;
      requestPasswordReset: FunctionReference<
        "mutation",
        "internal",
        { email: string; ipAddress?: string },
        any,
        Name
      >;
      resetPassword: FunctionReference<
        "mutation",
        "internal",
        { code: string; email: string; newPassword: string },
        any,
        Name
      >;
      signIn: FunctionReference<
        "mutation",
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
        "mutation",
        "internal",
        {
          defaultRole?: string;
          email: string;
          ipAddress?: string;
          name?: string;
          password: string;
        },
        any,
        Name
      >;
      validateSession: FunctionReference<
        "mutation",
        "internal",
        { checkBanned?: boolean; token: string },
        any,
        Name
      >;
      verifyEmail: FunctionReference<
        "mutation",
        "internal",
        { code: string; email: string },
        any,
        Name
      >;
    };
  };
