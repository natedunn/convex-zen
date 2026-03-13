import { describe, expect, it, vi } from "vitest";
import { ConvexZen } from "../src/client";
import {
  OrganizationPlugin,
  organizationPlugin,
} from "../src/client/plugins/organization";

function makeOrganizationPlugin() {
  return new OrganizationPlugin(
    {
      gateway: {
        organizationCheckSlug: "gateway:organizationCheckSlug",
        organizationCreate: "gateway:organizationCreate",
        organizationUpdate: "gateway:organizationUpdate",
        organizationDelete: "gateway:organizationDelete",
        organizationList: "gateway:organizationList",
        organizationGet: "gateway:organizationGet",
        organizationGetMembership: "gateway:organizationGetMembership",
        organizationListMembers: "gateway:organizationListMembers",
        organizationInviteMember: "gateway:organizationInviteMember",
        organizationListInvitations: "gateway:organizationListInvitations",
        organizationListIncomingInvitations: "gateway:organizationListIncomingInvitations",
        organizationAcceptInvitation: "gateway:organizationAcceptInvitation",
        organizationAcceptIncomingInvitation:
          "gateway:organizationAcceptIncomingInvitation",
        organizationCancelInvitation: "gateway:organizationCancelInvitation",
        organizationDeclineIncomingInvitation:
          "gateway:organizationDeclineIncomingInvitation",
        organizationRemoveMember: "gateway:organizationRemoveMember",
        organizationSetMemberRole: "gateway:organizationSetMemberRole",
        organizationTransferOwnership: "gateway:organizationTransferOwnership",
        organizationCreateRole: "gateway:organizationCreateRole",
        organizationListRoles: "gateway:organizationListRoles",
        organizationListAvailablePermissions:
          "gateway:organizationListAvailablePermissions",
        organizationGetRole: "gateway:organizationGetRole",
        organizationUpdateRole: "gateway:organizationUpdateRole",
        organizationDeleteRole: "gateway:organizationDeleteRole",
        organizationAddDomain: "gateway:organizationAddDomain",
        organizationListDomains: "gateway:organizationListDomains",
        organizationGetDomainVerificationChallenge:
          "gateway:organizationGetDomainVerificationChallenge",
        organizationMarkDomainVerified: "gateway:organizationMarkDomainVerified",
        organizationRemoveDomain: "gateway:organizationRemoveDomain",
        organizationResolveByHost: "gateway:organizationResolveByHost",
        organizationHasRole: "gateway:organizationHasRole",
        organizationRequireRole: "gateway:organizationRequireRole",
        organizationHasPermission: "gateway:organizationHasPermission",
        organizationRequirePermission: "gateway:organizationRequirePermission",
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
    })
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

    expect(runQuery).toHaveBeenNthCalledWith(1, "gateway:organizationCheckSlug", {
      slug: "acme",
    });
    expect(runMutation).toHaveBeenCalledWith("gateway:organizationInviteMember", {
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
    expect(runQuery).toHaveBeenNthCalledWith(2, "gateway:organizationResolveByHost", {
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
      "gateway:organizationHasPermission",
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

    expect(runQuery).toHaveBeenCalledWith(
      "gateway:organizationListIncomingInvitations",
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
      "gateway:organizationAcceptIncomingInvitation",
      {
        actorUserId: "user_1",
        invitationId: "invite_1",
      }
    );
    expect(runMutation).toHaveBeenNthCalledWith(
      2,
      "gateway:organizationDeclineIncomingInvitation",
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
      "gateway:organizationCreateRole",
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
      "gateway:organizationListAvailablePermissions",
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

describe("ConvexZen organization facade", () => {
  it("auto-resolves actorUserId for organization methods", async () => {
    const auth = new ConvexZen(
      {
        gateway: {
          organizationList: "gateway:organizationList",
          organizationGetMembership: "gateway:organizationGetMembership",
          organizationHasPermission: "gateway:organizationHasPermission",
        },
      },
      {
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
        resolveUserId: async () => "resolved_user",
      }
    );
    const runQuery = vi.fn(async (_fn, args) =>
      (args as { permission?: unknown }).permission ? true : { organizations: [] }
    );

    await auth.organization!.listOrganizations({ runQuery });
    const hasPermission = await auth.organization!.hasPermission(
      { runQuery },
      {
        organizationId: "org_1",
        permission: { resource: "project", action: "write" },
      }
    );

    expect(runQuery).toHaveBeenNthCalledWith(1, "gateway:organizationList", {
      actorUserId: "resolved_user",
    });
    expect(runQuery).toHaveBeenNthCalledWith(
      2,
      "gateway:organizationHasPermission",
      expect.objectContaining({
        actorUserId: "resolved_user",
        organizationId: "org_1",
        permission: { resource: "project", action: "write" },
        rolePermissions: expect.objectContaining({
          admin: expect.arrayContaining(["project:write"]),
        }),
      })
    );
    expect(hasPermission).toBe(true);
  });
});
