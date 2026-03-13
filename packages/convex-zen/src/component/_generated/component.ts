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
        any,
        Name
      >;
      getCurrentUser: FunctionReference<
        "query",
        "internal",
        { checkBanned?: boolean; token: string },
        any,
        Name
      >;
      getUserById: FunctionReference<
        "query",
        "internal",
        { checkBanned?: boolean; userId: string },
        any,
        Name
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
      organizationAcceptIncomingInvitation: FunctionReference<
        "mutation",
        "internal",
        { actorUserId: string; invitationId: string },
        any,
        Name
      >;
      organizationAcceptInvitation: FunctionReference<
        "mutation",
        "internal",
        {
          actorUserId: string;
          rolePermissions?: Record<string, Array<string>>;
          token: string;
        },
        any,
        Name
      >;
      organizationAddDomain: FunctionReference<
        "mutation",
        "internal",
        {
          actorUserId: string;
          hostname: string;
          organizationId: string;
          rolePermissions?: Record<string, Array<string>>;
        },
        any,
        Name
      >;
      organizationCancelInvitation: FunctionReference<
        "mutation",
        "internal",
        {
          actorUserId: string;
          invitationId: string;
          rolePermissions?: Record<string, Array<string>>;
        },
        any,
        Name
      >;
      organizationCheckSlug: FunctionReference<
        "query",
        "internal",
        { slug: string },
        any,
        Name
      >;
      organizationCreate: FunctionReference<
        "mutation",
        "internal",
        {
          actorUserId: string;
          allowUserOrganizationCreation?: boolean;
          logo?: string;
          name: string;
          slug: string;
        },
        any,
        Name
      >;
      organizationCreateRole: FunctionReference<
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
        any,
        Name
      >;
      organizationDeclineIncomingInvitation: FunctionReference<
        "mutation",
        "internal",
        { actorUserId: string; invitationId: string },
        any,
        Name
      >;
      organizationDelete: FunctionReference<
        "mutation",
        "internal",
        {
          actorUserId: string;
          organizationId: string;
          rolePermissions?: Record<string, Array<string>>;
        },
        any,
        Name
      >;
      organizationDeleteRole: FunctionReference<
        "mutation",
        "internal",
        {
          actorUserId: string;
          roleId: string;
          rolePermissions?: Record<string, Array<string>>;
        },
        any,
        Name
      >;
      organizationGet: FunctionReference<
        "query",
        "internal",
        {
          actorUserId: string;
          organizationId: string;
          rolePermissions?: Record<string, Array<string>>;
        },
        any,
        Name
      >;
      organizationGetDomainVerificationChallenge: FunctionReference<
        "query",
        "internal",
        {
          actorUserId: string;
          domainId: string;
          rolePermissions?: Record<string, Array<string>>;
        },
        any,
        Name
      >;
      organizationGetMembership: FunctionReference<
        "query",
        "internal",
        { actorUserId: string; organizationId: string },
        any,
        Name
      >;
      organizationGetRole: FunctionReference<
        "query",
        "internal",
        {
          actorUserId: string;
          roleId: string;
          rolePermissions?: Record<string, Array<string>>;
        },
        any,
        Name
      >;
      organizationHasPermission: FunctionReference<
        "query",
        "internal",
        {
          actorUserId: string;
          organizationId: string;
          permission: { action: string; resource: string };
          rolePermissions?: Record<string, Array<string>>;
        },
        any,
        Name
      >;
      organizationHasRole: FunctionReference<
        "query",
        "internal",
        {
          actorUserId: string;
          organizationId: string;
          role?: string;
          roles?: Array<string>;
        },
        any,
        Name
      >;
      organizationInviteMember: FunctionReference<
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
        any,
        Name
      >;
      organizationList: FunctionReference<
        "query",
        "internal",
        { actorUserId: string },
        any,
        Name
      >;
      organizationListAvailablePermissions: FunctionReference<
        "query",
        "internal",
        {
          accessControl?: Record<string, Array<string>>;
          actorUserId: string;
          organizationId: string;
          rolePermissions?: Record<string, Array<string>>;
        },
        any,
        Name
      >;
      organizationListDomains: FunctionReference<
        "query",
        "internal",
        {
          actorUserId: string;
          organizationId: string;
          rolePermissions?: Record<string, Array<string>>;
        },
        any,
        Name
      >;
      organizationListIncomingInvitations: FunctionReference<
        "query",
        "internal",
        { actorUserId: string },
        any,
        Name
      >;
      organizationListInvitations: FunctionReference<
        "query",
        "internal",
        {
          actorUserId: string;
          organizationId: string;
          rolePermissions?: Record<string, Array<string>>;
        },
        any,
        Name
      >;
      organizationListMembers: FunctionReference<
        "query",
        "internal",
        {
          actorUserId: string;
          organizationId: string;
          rolePermissions?: Record<string, Array<string>>;
        },
        any,
        Name
      >;
      organizationListRoles: FunctionReference<
        "query",
        "internal",
        {
          actorUserId: string;
          organizationId: string;
          rolePermissions?: Record<string, Array<string>>;
        },
        any,
        Name
      >;
      organizationMarkDomainVerified: FunctionReference<
        "mutation",
        "internal",
        {
          actorUserId: string;
          domainId: string;
          rolePermissions?: Record<string, Array<string>>;
        },
        any,
        Name
      >;
      organizationRemoveDomain: FunctionReference<
        "mutation",
        "internal",
        {
          actorUserId: string;
          domainId: string;
          rolePermissions?: Record<string, Array<string>>;
        },
        any,
        Name
      >;
      organizationRemoveMember: FunctionReference<
        "mutation",
        "internal",
        {
          actorUserId: string;
          organizationId: string;
          rolePermissions?: Record<string, Array<string>>;
          userId: string;
        },
        any,
        Name
      >;
      organizationRequirePermission: FunctionReference<
        "query",
        "internal",
        {
          actorUserId: string;
          organizationId: string;
          permission: { action: string; resource: string };
          rolePermissions?: Record<string, Array<string>>;
        },
        any,
        Name
      >;
      organizationRequireRole: FunctionReference<
        "query",
        "internal",
        {
          actorUserId: string;
          organizationId: string;
          role?: string;
          roles?: Array<string>;
        },
        any,
        Name
      >;
      organizationResolveByHost: FunctionReference<
        "query",
        "internal",
        { host: string; subdomainSuffix?: string },
        any,
        Name
      >;
      organizationSetMemberRole: FunctionReference<
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
        any,
        Name
      >;
      organizationTransferOwnership: FunctionReference<
        "mutation",
        "internal",
        {
          actorUserId: string;
          newOwnerUserId: string;
          organizationId: string;
          rolePermissions?: Record<string, Array<string>>;
        },
        any,
        Name
      >;
      organizationUpdate: FunctionReference<
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
        any,
        Name
      >;
      organizationUpdateRole: FunctionReference<
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
