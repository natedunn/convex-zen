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
    admin: {
      gateway: {
        banUser: FunctionReference<
          "mutation",
          "internal",
          {
            actorUserId?: string;
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
          { actorUserId?: string; userId: string },
          any,
          Name
        >;
        isAdmin: FunctionReference<
          "query",
          "internal",
          { actorUserId?: string },
          any,
          Name
        >;
        listUsers: FunctionReference<
          "query",
          "internal",
          { actorUserId?: string; cursor?: string; limit?: number },
          any,
          Name
        >;
        setRole: FunctionReference<
          "mutation",
          "internal",
          { actorUserId?: string; role: string; userId: string },
          any,
          Name
        >;
        unbanUser: FunctionReference<
          "mutation",
          "internal",
          { actorUserId?: string; userId: string },
          any,
          Name
        >;
      };
    };
    gateway: {
      getAuthorizationUrl: FunctionReference<
        "mutation",
        "internal",
        {
          callbackUrl?: string;
          errorRedirectTo?: string;
          provider: {
            authorizationUrl: string;
            clientId: string;
            clientSecret: string;
            id: string;
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
            authorizationUrl: string;
            clientId: string;
            clientSecret: string;
            id: string;
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
    organization: {
      gateway: {
        acceptIncomingInvitation: FunctionReference<
          "mutation",
          "internal",
          { actorEmail?: string; actorUserId?: string; invitationId: string },
          any,
          Name
        >;
        acceptInvitation: FunctionReference<
          "mutation",
          "internal",
          { actorEmail?: string; actorUserId?: string; token: string },
          any,
          Name
        >;
        addDomain: FunctionReference<
          "mutation",
          "internal",
          { actorUserId?: string; hostname: string; organizationId: string },
          any,
          Name
        >;
        cancelInvitation: FunctionReference<
          "mutation",
          "internal",
          { actorUserId?: string; invitationId: string },
          any,
          Name
        >;
        checkSlug: FunctionReference<
          "query",
          "internal",
          { slug: string },
          any,
          Name
        >;
        createOrganization: FunctionReference<
          "mutation",
          "internal",
          { actorUserId?: string; logo?: string; name: string; slug: string },
          any,
          Name
        >;
        createRole: FunctionReference<
          "mutation",
          "internal",
          {
            actorUserId?: string;
            description?: string;
            name: string;
            organizationId: string;
            permissions: Array<string>;
            slug: string;
          },
          any,
          Name
        >;
        declineIncomingInvitation: FunctionReference<
          "mutation",
          "internal",
          { actorEmail?: string; actorUserId?: string; invitationId: string },
          any,
          Name
        >;
        deleteOrganization: FunctionReference<
          "mutation",
          "internal",
          { actorUserId?: string; organizationId: string },
          any,
          Name
        >;
        deleteRole: FunctionReference<
          "mutation",
          "internal",
          { actorUserId?: string; roleId: string },
          any,
          Name
        >;
        getDomainVerificationChallenge: FunctionReference<
          "query",
          "internal",
          { actorUserId?: string; domainId: string },
          any,
          Name
        >;
        getMembership: FunctionReference<
          "query",
          "internal",
          { actorUserId?: string; organizationId: string },
          any,
          Name
        >;
        getOrganization: FunctionReference<
          "query",
          "internal",
          { actorUserId?: string; organizationId: string },
          any,
          Name
        >;
        getRole: FunctionReference<
          "query",
          "internal",
          { actorUserId?: string; roleId: string },
          any,
          Name
        >;
        hasPermission: FunctionReference<
          "query",
          "internal",
          {
            actorUserId?: string;
            organizationId: string;
            permission: { action: string; resource: string };
          },
          any,
          Name
        >;
        hasRole: FunctionReference<
          "query",
          "internal",
          {
            actorUserId?: string;
            organizationId: string;
            role?: string;
            roles?: Array<string>;
          },
          any,
          Name
        >;
        inviteMember: FunctionReference<
          "mutation",
          "internal",
          {
            actorUserId?: string;
            email: string;
            organizationId: string;
            role:
              | { systemRole: string; type: "system" }
              | { customRoleId: string; type: "custom" };
          },
          any,
          Name
        >;
        listAvailablePermissions: FunctionReference<
          "query",
          "internal",
          { actorUserId?: string; organizationId: string },
          any,
          Name
        >;
        listDomains: FunctionReference<
          "query",
          "internal",
          { actorUserId?: string; organizationId: string },
          any,
          Name
        >;
        listIncomingInvitations: FunctionReference<
          "query",
          "internal",
          { actorEmail?: string; actorUserId?: string },
          any,
          Name
        >;
        listInvitations: FunctionReference<
          "query",
          "internal",
          { actorUserId?: string; organizationId: string },
          any,
          Name
        >;
        listMembers: FunctionReference<
          "query",
          "internal",
          { actorUserId?: string; organizationId: string },
          any,
          Name
        >;
        listOrganizations: FunctionReference<
          "query",
          "internal",
          { actorUserId?: string },
          any,
          Name
        >;
        listRoles: FunctionReference<
          "query",
          "internal",
          { actorUserId?: string; organizationId: string },
          any,
          Name
        >;
        markDomainVerified: FunctionReference<
          "mutation",
          "internal",
          { actorUserId?: string; domainId: string },
          any,
          Name
        >;
        removeDomain: FunctionReference<
          "mutation",
          "internal",
          { actorUserId?: string; domainId: string },
          any,
          Name
        >;
        removeMember: FunctionReference<
          "mutation",
          "internal",
          { actorUserId?: string; organizationId: string; userId: string },
          any,
          Name
        >;
        requirePermission: FunctionReference<
          "query",
          "internal",
          {
            actorUserId?: string;
            organizationId: string;
            permission: { action: string; resource: string };
          },
          any,
          Name
        >;
        requireRole: FunctionReference<
          "query",
          "internal",
          {
            actorUserId?: string;
            organizationId: string;
            role?: string;
            roles?: Array<string>;
          },
          any,
          Name
        >;
        resolveOrganizationByHost: FunctionReference<
          "query",
          "internal",
          { host: string },
          any,
          Name
        >;
        setMemberRole: FunctionReference<
          "mutation",
          "internal",
          {
            actorUserId?: string;
            organizationId: string;
            role:
              | { systemRole: string; type: "system" }
              | { customRoleId: string; type: "custom" };
            userId: string;
          },
          any,
          Name
        >;
        transferOwnership: FunctionReference<
          "mutation",
          "internal",
          {
            actorUserId?: string;
            newOwnerUserId: string;
            organizationId: string;
          },
          any,
          Name
        >;
        updateOrganization: FunctionReference<
          "mutation",
          "internal",
          {
            actorUserId?: string;
            logo?: string;
            name?: string;
            organizationId: string;
            slug?: string;
          },
          any,
          Name
        >;
        updateRole: FunctionReference<
          "mutation",
          "internal",
          {
            actorUserId?: string;
            description?: string;
            name?: string;
            permissions?: Array<string>;
            roleId: string;
            slug?: string;
          },
          any,
          Name
        >;
      };
    };
  };
