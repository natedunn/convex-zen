import { describe, expect, it, vi } from "vitest";
import { createConvexZenClient, defineConvexZen } from "../src/client";
import {
  OrganizationPlugin,
  organizationPlugin,
} from "../../convex-zen-organization/src";

function makeOrganizationPlugin() {
  return new OrganizationPlugin(
    {
      core: {
        gateway: {
          getUserById: "core/gateway:getUserById",
        },
      },
      organization: {
        gateway: {
          checkSlug: "organization/gateway:checkSlug",
          createOrganization: "organization/gateway:createOrganization",
          updateOrganization: "organization/gateway:updateOrganization",
          deleteOrganization: "organization/gateway:deleteOrganization",
          listOrganizations: "organization/gateway:listOrganizations",
          getOrganization: "organization/gateway:getOrganization",
          getMembership: "organization/gateway:getMembership",
          listMembers: "organization/gateway:listMembers",
          inviteMember: "organization/gateway:inviteMember",
          listInvitations: "organization/gateway:listInvitations",
          listIncomingInvitations: "organization/gateway:listIncomingInvitations",
          acceptInvitation: "organization/gateway:acceptInvitation",
          acceptIncomingInvitation:
            "organization/gateway:acceptIncomingInvitation",
          cancelInvitation: "organization/gateway:cancelInvitation",
          declineIncomingInvitation:
            "organization/gateway:declineIncomingInvitation",
          removeMember: "organization/gateway:removeMember",
          setMemberRole: "organization/gateway:setMemberRole",
          transferOwnership: "organization/gateway:transferOwnership",
          createRole: "organization/gateway:createRole",
          listRoles: "organization/gateway:listRoles",
          listAvailablePermissions:
            "organization/gateway:listAvailablePermissions",
          getRole: "organization/gateway:getRole",
          updateRole: "organization/gateway:updateRole",
          deleteRole: "organization/gateway:deleteRole",
          addDomain: "organization/gateway:addDomain",
          listDomains: "organization/gateway:listDomains",
          getDomainVerificationChallenge:
            "organization/gateway:getDomainVerificationChallenge",
          markDomainVerified: "organization/gateway:markDomainVerified",
          removeDomain: "organization/gateway:removeDomain",
          resolveOrganizationByHost: "organization/gateway:resolveOrganizationByHost",
          hasRole: "organization/gateway:hasRole",
          requireRole: "organization/gateway:requireRole",
          hasPermission: "organization/gateway:hasPermission",
          requirePermission: "organization/gateway:requirePermission",
        },
      },
    },
    organizationPlugin({
      inviteExpiresInMs: 1234,
      accessControl: {
        billing: ["read"],
      },
      roles: {
        owner: {
          billing: ["read"],
        },
        admin: {
          billing: ["read"],
        },
      },
      subdomainSuffix: "example.com",
    }).options,
    "organization",
    "component"
  );
}

describe("OrganizationPlugin client", () => {
  it("calls gateway functions with plugin config-derived payload", async () => {
    const plugin = makeOrganizationPlugin();
    const runMutation = vi.fn(async () => ({ ok: true }));
    const runQuery = vi.fn(async () => ({ available: true }));

    await plugin.checkSlug({ runQuery }, { slug: "acme" });
    await plugin.inviteMember(
      { runMutation },
      {
        actorUserId: "user_1",
        organizationId: "org_1",
        email: "hello@example.com",
        role: {
          type: "system",
          systemRole: "member",
        },
      }
    );
    await plugin.resolveOrganizationByHost({ runQuery }, { host: "acme.example.com" });

    expect(runQuery).toHaveBeenNthCalledWith(1, "organization/gateway:checkSlug", {
      slug: "acme",
    });
    expect(runMutation).toHaveBeenCalledWith("organization/gateway:inviteMember", {
      actorUserId: "user_1",
      organizationId: "org_1",
      email: "hello@example.com",
      role: {
        type: "system",
        systemRole: "member",
      },
      inviteExpiresInMs: 1234,
      accessControl: {
        organization: ["read", "update", "delete", "transfer"],
        accessControl: ["read"],
        role: ["read", "create", "update", "delete"],
        member: ["read", "create", "update", "delete"],
        invitation: ["read", "create", "cancel", "accept"],
        domain: ["read", "create", "verify", "delete"],
        billing: ["read"],
      },
      rolePermissions: {
        owner: expect.arrayContaining(["billing:read", "organization:update", "role:create"]),
        admin: expect.arrayContaining(["billing:read", "organization:update", "role:update"]),
        member: expect.arrayContaining(["organization:read"]),
      },
    });
    expect(runQuery).toHaveBeenNthCalledWith(2, "organization/gateway:resolveOrganizationByHost", {
      host: "acme.example.com",
      subdomainSuffix: "example.com",
    });
  });

  it("passes object permissions and role mappings to gateway permission checks", async () => {
    const plugin = makeOrganizationPlugin();
    const runQuery = vi.fn(async () => true);

    await expect(
      plugin.hasPermission(
        { runQuery },
        {
          actorUserId: "user_1",
          organizationId: "org_1",
          permission: { resource: "billing", action: "read" },
        }
      )
    ).resolves.toBe(true);

    expect(runQuery).toHaveBeenCalledWith(
      "organization/gateway:hasPermission",
      expect.objectContaining({
        actorUserId: "user_1",
        organizationId: "org_1",
        permission: { resource: "billing", action: "read" },
        rolePermissions: expect.objectContaining({
          admin: expect.arrayContaining(["billing:read"]),
        }),
      })
    );
  });

  it("loads incoming invitations for the current actor through the gateway", async () => {
    const plugin = makeOrganizationPlugin();
    const runQuery = vi.fn(async () => []);

    await plugin.listIncomingInvitations(
      { runQuery },
      {
        actorUserId: "user_1",
      }
    );

    expect(runQuery).toHaveBeenCalledTimes(1);
    expect(runQuery).toHaveBeenCalledWith(
      "organization/gateway:listIncomingInvitations",
      {
        actorUserId: "user_1",
      }
    );
  });

  it("passes only actorUserId when listing incoming invitations (no app/component distinction)", async () => {
    const plugin = new OrganizationPlugin(
      {
        organization: {
          gateway: {
            listIncomingInvitations:
              "organization/gateway:listIncomingInvitations",
          },
        },
      },
      organizationPlugin({}).options,
      "organizationComponent",
      "app"
    );
    const runQuery = vi.fn(async () => []);

    await plugin.listIncomingInvitations(
      { runQuery },
      {
        actorUserId: "user_1",
      }
    );

    expect(runQuery).toHaveBeenCalledTimes(1);
    expect(runQuery).toHaveBeenCalledWith(
      "organization/gateway:listIncomingInvitations",
      {
        actorUserId: "user_1",
      }
    );
  });

  it("accepts and declines incoming invitations through dedicated gateway mutations", async () => {
    const plugin = makeOrganizationPlugin();
    const runMutation = vi.fn(async () => ({ ok: true }));

    await plugin.acceptIncomingInvitation(
      { runMutation },
      { actorUserId: "user_1", invitationId: "invite_1" }
    );
    await plugin.declineIncomingInvitation(
      { runMutation },
      { actorUserId: "user_1", invitationId: "invite_2" }
    );

    expect(runMutation).toHaveBeenNthCalledWith(
      1,
      "organization/gateway:acceptIncomingInvitation",
      {
        actorUserId: "user_1",
        invitationId: "invite_1",
      }
    );
    expect(runMutation).toHaveBeenNthCalledWith(
      2,
      "organization/gateway:declineIncomingInvitation",
      {
        actorUserId: "user_1",
        invitationId: "invite_2",
      }
    );
  });

  it("passes access-control context to dynamic role mutations", async () => {
    const plugin = makeOrganizationPlugin();
    const runMutation = vi.fn(async () => ({ ok: true }));

    await plugin.createRole(
      { runMutation },
      {
        actorUserId: "user_1",
        organizationId: "org_1",
        name: "Billing Admin",
        slug: "billing-admin",
        permissions: ["billing:read"],
      }
    );

    expect(runMutation).toHaveBeenCalledWith(
      "organization/gateway:createRole",
      expect.objectContaining({
        actorUserId: "user_1",
        organizationId: "org_1",
        name: "Billing Admin",
        slug: "billing-admin",
        permissions: ["billing:read"],
        accessControl: expect.objectContaining({
          billing: ["read"],
        }),
        rolePermissions: expect.objectContaining({
          owner: expect.arrayContaining(["role:create"]),
        }),
      })
    );
  });

  it("loads available permissions through the gateway with access-control context", async () => {
    const plugin = makeOrganizationPlugin();
    const runQuery = vi.fn(async () => ({
      resources: {
        organization: ["read"],
      },
      permissions: ["organization:read"],
    }));

    await plugin.listAvailablePermissions(
      { runQuery },
      {
        actorUserId: "user_1",
        organizationId: "org_1",
      }
    );

    expect(runQuery).toHaveBeenCalledWith(
      "organization/gateway:listAvailablePermissions",
      expect.objectContaining({
        actorUserId: "user_1",
        organizationId: "org_1",
        accessControl: expect.objectContaining({
          accessControl: ["read"],
          billing: ["read"],
        }),
        rolePermissions: expect.objectContaining({
          admin: expect.arrayContaining(["accessControl:read"]),
          owner: expect.arrayContaining(["accessControl:read"]),
        }),
      })
    );
  });
});

describe("ConvexZen organization plugins", () => {
  it("exposes configured organization runtime under auth.plugins", async () => {
    const auth = createConvexZenClient(
      {
        organization: {
          gateway: {
            listOrganizations: "organization/gateway:listOrganizations",
            hasPermission: "organization/gateway:hasPermission",
          },
        },
      },
      defineConvexZen({
        plugins: [
          organizationPlugin({
            accessControl: {
              project: ["write"],
            },
            roles: {
              admin: {
                project: ["write"],
              },
            },
          }),
        ] as const,
      })
    );
    const runQuery = vi.fn(async (_fn, args) =>
      (args as { permission?: unknown }).permission ? true : { organizations: [] }
    );

    await auth.plugins.organization.listOrganizations(
      { runQuery },
      {
        actorUserId: "resolved_user",
      }
    );
    const hasPermission = await auth.plugins.organization.hasPermission(
      { runQuery },
      {
        actorUserId: "resolved_user",
        organizationId: "org_1",
        permission: { resource: "project", action: "write" },
      }
    );

    expect(runQuery).toHaveBeenNthCalledWith(1, "organization/gateway:listOrganizations", {
      actorUserId: "resolved_user",
    });
    expect(runQuery).toHaveBeenNthCalledWith(
      2,
      "organization/gateway:hasPermission",
      {
        actorUserId: "resolved_user",
        organizationId: "org_1",
        permission: { resource: "project", action: "write" },
      }
    );
    expect(hasPermission).toBe(true);
  });
});
