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
            checkBanned?: boolean;
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
            checkBanned?: boolean;
            email: string;
            ipAddress?: string;
            password: string;
            requireVerification?: boolean;
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
    plugins: {
      example: {
        gateway: {
          listLogs: FunctionReference<
            "query",
            "internal",
            { limit?: number; scope?: string },
            any,
            Name
          >;
          log: FunctionReference<
            "mutation",
            "internal",
            {
              level: "debug" | "info" | "warn" | "error";
              message: string;
              scope?: string;
              tag?: string;
            },
            any,
            Name
          >;
        };
      };
      organization: {
        gateway: {
          acceptIncomingInvitation: FunctionReference<
            "mutation",
            "internal",
            { invitationId: string },
            any,
            Name
          >;
          acceptInvitation: FunctionReference<
            "mutation",
            "internal",
            { rolePermissions?: Record<string, Array<string>>; token: string },
            any,
            Name
          >;
          addDomain: FunctionReference<
            "mutation",
            "internal",
            {
              hostname: string;
              organizationId: string;
              rolePermissions?: Record<string, Array<string>>;
            },
            any,
            Name
          >;
          cancelInvitation: FunctionReference<
            "mutation",
            "internal",
            {
              invitationId: string;
              rolePermissions?: Record<string, Array<string>>;
            },
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
            {
              allowUserOrganizationCreation?: boolean;
              logo?: string;
              name: string;
              slug: string;
            },
            any,
            Name
          >;
          createRole: FunctionReference<
            "mutation",
            "internal",
            {
              accessControl?: Record<string, Array<string>>;
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
          declineIncomingInvitation: FunctionReference<
            "mutation",
            "internal",
            { invitationId: string },
            any,
            Name
          >;
          deleteOrganization: FunctionReference<
            "mutation",
            "internal",
            {
              organizationId: string;
              rolePermissions?: Record<string, Array<string>>;
            },
            any,
            Name
          >;
          deleteRole: FunctionReference<
            "mutation",
            "internal",
            { roleId: string; rolePermissions?: Record<string, Array<string>> },
            any,
            Name
          >;
          getDomainVerificationChallenge: FunctionReference<
            "query",
            "internal",
            {
              domainId: string;
              rolePermissions?: Record<string, Array<string>>;
            },
            any,
            Name
          >;
          getMembership: FunctionReference<
            "query",
            "internal",
            { organizationId: string },
            any,
            Name
          >;
          getOrganization: FunctionReference<
            "query",
            "internal",
            {
              organizationId: string;
              rolePermissions?: Record<string, Array<string>>;
            },
            any,
            Name
          >;
          getRole: FunctionReference<
            "query",
            "internal",
            { roleId: string; rolePermissions?: Record<string, Array<string>> },
            any,
            Name
          >;
          hasPermission: FunctionReference<
            "query",
            "internal",
            {
              organizationId: string;
              permission: { action: string; resource: string };
              rolePermissions?: Record<string, Array<string>>;
            },
            any,
            Name
          >;
          hasRole: FunctionReference<
            "query",
            "internal",
            { organizationId: string; role?: string; roles?: Array<string> },
            any,
            Name
          >;
          inviteMember: FunctionReference<
            "mutation",
            "internal",
            {
              accessControl?: Record<string, Array<string>>;
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
          listAvailablePermissions: FunctionReference<
            "query",
            "internal",
            {
              accessControl?: Record<string, Array<string>>;
              organizationId: string;
              rolePermissions?: Record<string, Array<string>>;
            },
            any,
            Name
          >;
          listDomains: FunctionReference<
            "query",
            "internal",
            {
              organizationId: string;
              rolePermissions?: Record<string, Array<string>>;
            },
            any,
            Name
          >;
          listIncomingInvitations: FunctionReference<
            "query",
            "internal",
            {},
            any,
            Name
          >;
          listInvitations: FunctionReference<
            "query",
            "internal",
            {
              organizationId: string;
              rolePermissions?: Record<string, Array<string>>;
            },
            any,
            Name
          >;
          listMembers: FunctionReference<
            "query",
            "internal",
            {
              organizationId: string;
              rolePermissions?: Record<string, Array<string>>;
            },
            any,
            Name
          >;
          listOrganizations: FunctionReference<
            "query",
            "internal",
            {},
            any,
            Name
          >;
          listRoles: FunctionReference<
            "query",
            "internal",
            {
              organizationId: string;
              rolePermissions?: Record<string, Array<string>>;
            },
            any,
            Name
          >;
          markDomainVerified: FunctionReference<
            "mutation",
            "internal",
            {
              domainId: string;
              rolePermissions?: Record<string, Array<string>>;
            },
            any,
            Name
          >;
          removeDomain: FunctionReference<
            "mutation",
            "internal",
            {
              domainId: string;
              rolePermissions?: Record<string, Array<string>>;
            },
            any,
            Name
          >;
          removeMember: FunctionReference<
            "mutation",
            "internal",
            {
              organizationId: string;
              rolePermissions?: Record<string, Array<string>>;
              userId: string;
            },
            any,
            Name
          >;
          requirePermission: FunctionReference<
            "query",
            "internal",
            {
              organizationId: string;
              permission: { action: string; resource: string };
              rolePermissions?: Record<string, Array<string>>;
            },
            any,
            Name
          >;
          requireRole: FunctionReference<
            "query",
            "internal",
            { organizationId: string; role?: string; roles?: Array<string> },
            any,
            Name
          >;
          resolveOrganizationByHost: FunctionReference<
            "query",
            "internal",
            { host: string; subdomainSuffix?: string },
            any,
            Name
          >;
          setMemberRole: FunctionReference<
            "mutation",
            "internal",
            {
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
          transferOwnership: FunctionReference<
            "mutation",
            "internal",
            {
              newOwnerUserId: string;
              organizationId: string;
              rolePermissions?: Record<string, Array<string>>;
            },
            any,
            Name
          >;
          updateOrganization: FunctionReference<
            "mutation",
            "internal",
            {
              logo?: string;
              name?: string;
              organizationId: string;
              rolePermissions?: Record<string, Array<string>>;
              slug?: string;
            },
            any,
            Name
          >;
          updateRole: FunctionReference<
            "mutation",
            "internal",
            {
              accessControl?: Record<string, Array<string>>;
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
        };
      };
      systemAdmin: {
        gateway: {
          banUser: FunctionReference<
            "mutation",
            "internal",
            {
              adminRole?: string;
              expiresAt?: number;
              reason?: string;
              userId: string;
            },
            any,
            Name
          >;
          bootstrapAdmin: FunctionReference<
            "mutation",
            "internal",
            { adminRole?: string },
            any,
            Name
          >;
          canBootstrapAdmin: FunctionReference<
            "query",
            "internal",
            { adminRole?: string },
            any,
            Name
          >;
          deleteUser: FunctionReference<
            "mutation",
            "internal",
            { adminRole?: string; userId: string },
            any,
            Name
          >;
          isAdmin: FunctionReference<
            "query",
            "internal",
            { adminRole?: string },
            any,
            Name
          >;
          listUsers: FunctionReference<
            "query",
            "internal",
            { adminRole?: string; cursor?: string; limit?: number },
            any,
            Name
          >;
          setRole: FunctionReference<
            "mutation",
            "internal",
            { adminRole?: string; role: string; userId: string },
            any,
            Name
          >;
          unbanUser: FunctionReference<
            "mutation",
            "internal",
            { adminRole?: string; userId: string },
            any,
            Name
          >;
        };
      };
    };
  };
