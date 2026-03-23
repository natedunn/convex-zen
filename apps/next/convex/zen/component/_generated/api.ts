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
import type * as systemAdmin_gateway from "../systemAdmin/gateway.js";
import type * as gateway from "../gateway.js";
import type * as organization_gateway from "../organization/gateway.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import { anyApi, componentsGeneric } from "convex/server";

const fullApi: ApiFromModules<{
  _runtime: typeof _runtime;
  "systemAdmin/gateway": typeof systemAdmin_gateway;
  gateway: typeof gateway;
  "organization/gateway": typeof organization_gateway;
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
  core: {
    gateway: {
      getAuthorizationUrl: FunctionReference<
        "mutation",
        "internal",
        {
          callbackUrl?: string;
          errorRedirectTo?: string;
          provider: {
            accessType?: "offline" | "online";
            authorizationUrl: string;
            clientId: string;
            clientSecret: string;
            hostedDomain?: string;
            id: string;
            prompt?: "none" | "consent" | "select_account";
            runtimeConfig?: any;
            scopes: Array<string>;
            tokenEncryptionSecret?: string;
            tokenUrl: string;
            trustVerifiedEmail?: boolean;
            userInfoUrl: string;
          };
          redirectTo?: string;
          redirectUrl?: string;
        },
        any
      >;
      getCurrentUser: FunctionReference<
        "query",
        "internal",
        { checkBanned?: boolean; token: string },
        any
      >;
      getUserById: FunctionReference<
        "query",
        "internal",
        { checkBanned?: boolean; userId: string },
        any
      >;
      handleCallback: FunctionReference<
        "action",
        "internal",
        {
          callbackUrl?: string;
          code: string;
          defaultRole?: string;
          errorRedirectTo?: string;
          ipAddress?: string;
          provider: {
            accessType?: "offline" | "online";
            authorizationUrl: string;
            clientId: string;
            clientSecret: string;
            hostedDomain?: string;
            id: string;
            prompt?: "none" | "consent" | "select_account";
            runtimeConfig?: any;
            scopes: Array<string>;
            tokenEncryptionSecret?: string;
            tokenUrl: string;
            trustVerifiedEmail?: boolean;
            userInfoUrl: string;
          };
          redirectTo?: string;
          redirectUrl?: string;
          state: string;
          userAgent?: string;
        },
        any
      >;
      invalidateAllSessions: FunctionReference<
        "mutation",
        "internal",
        { userId: string },
        any
      >;
      invalidateSession: FunctionReference<
        "mutation",
        "internal",
        { token: string },
        any
      >;
      requestPasswordReset: FunctionReference<
        "mutation",
        "internal",
        { email: string; ipAddress?: string },
        any
      >;
      resetPassword: FunctionReference<
        "mutation",
        "internal",
        { code: string; email: string; newPassword: string },
        any
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
        any
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
        any
      >;
      validateSession: FunctionReference<
        "mutation",
        "internal",
        { checkBanned?: boolean; token: string },
        any
      >;
      verifyEmail: FunctionReference<
        "mutation",
        "internal",
        { code: string; email: string },
        any
      >;
    };
  };
  systemAdminComponent: {
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
        any
      >;
      deleteUser: FunctionReference<
        "mutation",
        "internal",
        { actorUserId: string; adminRole?: string; userId: string },
        any
      >;
      isAdmin: FunctionReference<
        "query",
        "internal",
        { actorUserId: string; adminRole?: string },
        any
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
        any
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
        any
      >;
      unbanUser: FunctionReference<
        "mutation",
        "internal",
        { actorUserId: string; adminRole?: string; userId: string },
        any
      >;
    };
  };
  organizationComponent: {
    gateway: {
      acceptIncomingInvitation: FunctionReference<
        "mutation",
        "internal",
        { actorEmail?: string; actorUserId: string; invitationId: string },
        any
      >;
      acceptInvitation: FunctionReference<
        "mutation",
        "internal",
        {
          actorEmail?: string;
          actorUserId: string;
          rolePermissions?: Record<string, Array<string>>;
          token: string;
        },
        any
      >;
      addDomain: FunctionReference<
        "mutation",
        "internal",
        {
          actorUserId: string;
          hostname: string;
          organizationId: string;
          rolePermissions?: Record<string, Array<string>>;
        },
        any
      >;
      cancelInvitation: FunctionReference<
        "mutation",
        "internal",
        {
          actorUserId: string;
          invitationId: string;
          rolePermissions?: Record<string, Array<string>>;
        },
        any
      >;
      checkSlug: FunctionReference<"query", "internal", { slug: string }, any>;
      createOrganization: FunctionReference<
        "mutation",
        "internal",
        {
          actorUserId: string;
          allowUserOrganizationCreation?: boolean;
          logo?: string;
          name: string;
          slug: string;
        },
        any
      >;
      createRole: FunctionReference<
        "mutation",
        "internal",
        {
          accessControl?: Record<string, Array<string>>;
          actorUserId: string;
          description?: string;
          name: string;
          organizationId: string;
          permissions: Array<string>;
          rolePermissions?: Record<string, Array<string>>;
          slug: string;
        },
        any
      >;
      declineIncomingInvitation: FunctionReference<
        "mutation",
        "internal",
        { actorEmail?: string; actorUserId: string; invitationId: string },
        any
      >;
      deleteOrganization: FunctionReference<
        "mutation",
        "internal",
        {
          actorUserId: string;
          organizationId: string;
          rolePermissions?: Record<string, Array<string>>;
        },
        any
      >;
      deleteRole: FunctionReference<
        "mutation",
        "internal",
        {
          actorUserId: string;
          roleId: string;
          rolePermissions?: Record<string, Array<string>>;
        },
        any
      >;
      getDomainVerificationChallenge: FunctionReference<
        "query",
        "internal",
        {
          actorUserId: string;
          domainId: string;
          rolePermissions?: Record<string, Array<string>>;
        },
        any
      >;
      getMembership: FunctionReference<
        "query",
        "internal",
        { actorUserId: string; organizationId: string },
        any
      >;
      getOrganization: FunctionReference<
        "query",
        "internal",
        {
          actorUserId: string;
          organizationId: string;
          rolePermissions?: Record<string, Array<string>>;
        },
        any
      >;
      getRole: FunctionReference<
        "query",
        "internal",
        {
          actorUserId: string;
          roleId: string;
          rolePermissions?: Record<string, Array<string>>;
        },
        any
      >;
      hasPermission: FunctionReference<
        "query",
        "internal",
        {
          actorUserId: string;
          organizationId: string;
          permission: { action: string; resource: string };
          rolePermissions?: Record<string, Array<string>>;
        },
        any
      >;
      hasRole: FunctionReference<
        "query",
        "internal",
        {
          actorUserId: string;
          organizationId: string;
          role?: string;
          roles?: Array<string>;
        },
        any
      >;
      inviteMember: FunctionReference<
        "mutation",
        "internal",
        {
          accessControl?: Record<string, Array<string>>;
          actorUserId: string;
          email: string;
          inviteExpiresInMs?: number;
          organizationId: string;
          role:
            | { systemRole: string; type: "system" }
            | { customRoleId: string; type: "custom" };
          rolePermissions?: Record<string, Array<string>>;
        },
        any
      >;
      listAvailablePermissions: FunctionReference<
        "query",
        "internal",
        {
          accessControl?: Record<string, Array<string>>;
          actorUserId: string;
          organizationId: string;
          rolePermissions?: Record<string, Array<string>>;
        },
        any
      >;
      listDomains: FunctionReference<
        "query",
        "internal",
        {
          actorUserId: string;
          organizationId: string;
          rolePermissions?: Record<string, Array<string>>;
        },
        any
      >;
      listIncomingInvitations: FunctionReference<
        "query",
        "internal",
        { actorEmail?: string; actorUserId: string },
        any
      >;
      listInvitations: FunctionReference<
        "query",
        "internal",
        {
          actorUserId: string;
          organizationId: string;
          rolePermissions?: Record<string, Array<string>>;
        },
        any
      >;
      listMembers: FunctionReference<
        "query",
        "internal",
        {
          actorUserId: string;
          organizationId: string;
          rolePermissions?: Record<string, Array<string>>;
        },
        any
      >;
      listOrganizations: FunctionReference<
        "query",
        "internal",
        { actorUserId: string },
        any
      >;
      listRoles: FunctionReference<
        "query",
        "internal",
        {
          actorUserId: string;
          organizationId: string;
          rolePermissions?: Record<string, Array<string>>;
        },
        any
      >;
      markDomainVerified: FunctionReference<
        "mutation",
        "internal",
        {
          actorUserId: string;
          domainId: string;
          rolePermissions?: Record<string, Array<string>>;
        },
        any
      >;
      removeDomain: FunctionReference<
        "mutation",
        "internal",
        {
          actorUserId: string;
          domainId: string;
          rolePermissions?: Record<string, Array<string>>;
        },
        any
      >;
      removeMember: FunctionReference<
        "mutation",
        "internal",
        {
          actorUserId: string;
          organizationId: string;
          rolePermissions?: Record<string, Array<string>>;
          userId: string;
        },
        any
      >;
      requirePermission: FunctionReference<
        "query",
        "internal",
        {
          actorUserId: string;
          organizationId: string;
          permission: { action: string; resource: string };
          rolePermissions?: Record<string, Array<string>>;
        },
        any
      >;
      requireRole: FunctionReference<
        "query",
        "internal",
        {
          actorUserId: string;
          organizationId: string;
          role?: string;
          roles?: Array<string>;
        },
        any
      >;
      resolveOrganizationByHost: FunctionReference<
        "query",
        "internal",
        { host: string; subdomainSuffix?: string },
        any
      >;
      setMemberRole: FunctionReference<
        "mutation",
        "internal",
        {
          actorUserId: string;
          organizationId: string;
          role:
            | { systemRole: string; type: "system" }
            | { customRoleId: string; type: "custom" };
          rolePermissions?: Record<string, Array<string>>;
          userId: string;
        },
        any
      >;
      transferOwnership: FunctionReference<
        "mutation",
        "internal",
        {
          actorUserId: string;
          newOwnerUserId: string;
          organizationId: string;
          rolePermissions?: Record<string, Array<string>>;
        },
        any
      >;
      updateOrganization: FunctionReference<
        "mutation",
        "internal",
        {
          actorUserId: string;
          logo?: string;
          name?: string;
          organizationId: string;
          rolePermissions?: Record<string, Array<string>>;
          slug?: string;
        },
        any
      >;
      updateRole: FunctionReference<
        "mutation",
        "internal",
        {
          accessControl?: Record<string, Array<string>>;
          actorUserId: string;
          description?: string;
          name?: string;
          permissions?: Array<string>;
          roleId: string;
          rolePermissions?: Record<string, Array<string>>;
          slug?: string;
        },
        any
      >;
    };
  };
};
