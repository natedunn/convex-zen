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
      acceptIncomingInvitation: FunctionReference<
        "mutation",
        "internal",
        { actorUserId: string; invitationId: string },
        any,
        Name
      >;
      acceptInvitation: FunctionReference<
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
      addDomain: FunctionReference<
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
      cancelInvitation: FunctionReference<
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
          actorUserId: string;
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
      declineIncomingInvitation: FunctionReference<
        "mutation",
        "internal",
        { actorUserId: string; invitationId: string },
        any,
        Name
      >;
      deleteOrganization: FunctionReference<
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
      deleteRole: FunctionReference<
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
      getDomainVerificationChallenge: FunctionReference<
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
      getMembership: FunctionReference<
        "query",
        "internal",
        { actorUserId: string; organizationId: string },
        any,
        Name
      >;
      getOrganization: FunctionReference<
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
      getRole: FunctionReference<
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
      hasPermission: FunctionReference<
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
      hasRole: FunctionReference<
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
        any,
        Name
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
        any,
        Name
      >;
      listDomains: FunctionReference<
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
      listIncomingInvitations: FunctionReference<
        "query",
        "internal",
        { actorUserId: string },
        any,
        Name
      >;
      listInvitations: FunctionReference<
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
      listMembers: FunctionReference<
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
      listOrganizations: FunctionReference<
        "query",
        "internal",
        { actorUserId: string },
        any,
        Name
      >;
      listRoles: FunctionReference<
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
      markDomainVerified: FunctionReference<
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
      removeDomain: FunctionReference<
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
      removeMember: FunctionReference<
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
      requirePermission: FunctionReference<
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
      requireRole: FunctionReference<
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
      transferOwnership: FunctionReference<
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
        any,
        Name
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
        any,
        Name
      >;
    };
  };
