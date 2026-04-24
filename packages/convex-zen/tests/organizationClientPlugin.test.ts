import { describe, expect, it, vi } from "vitest";
import { createConvexZenClient, defineConvexZen } from "../src/client";
import {
  OrganizationPlugin,
  organizationPlugin,
} from "../src/plugins/organization/runtime";

function gatewayQuery(path: string) {
  return async (
    ctx: { runQuery(fn: unknown, args: Record<string, unknown>): Promise<unknown> },
    args: Record<string, unknown>
  ) => ctx.runQuery(path, args);
}

function gatewayMutation(path: string) {
  return async (
    ctx: {
      runMutation(fn: unknown, args: Record<string, unknown>): Promise<unknown>;
    },
    args: Record<string, unknown>
  ) => ctx.runMutation(path, args);
}

function makeOrganizationGateway() {
  return {
    checkSlug: gatewayQuery("organization/gateway:checkSlug"),
    createOrganization: gatewayMutation("organization/gateway:createOrganization"),
    updateOrganization: gatewayMutation("organization/gateway:updateOrganization"),
    deleteOrganization: gatewayMutation("organization/gateway:deleteOrganization"),
    listOrganizations: gatewayQuery("organization/gateway:listOrganizations"),
    getOrganization: gatewayQuery("organization/gateway:getOrganization"),
    getMembership: gatewayQuery("organization/gateway:getMembership"),
    listMembers: gatewayQuery("organization/gateway:listMembers"),
    inviteMember: gatewayMutation("organization/gateway:inviteMember"),
    listInvitations: gatewayQuery("organization/gateway:listInvitations"),
    listIncomingInvitations: gatewayQuery(
      "organization/gateway:listIncomingInvitations"
    ),
    acceptInvitation: gatewayMutation("organization/gateway:acceptInvitation"),
    acceptIncomingInvitation: gatewayMutation(
      "organization/gateway:acceptIncomingInvitation"
    ),
    cancelInvitation: gatewayMutation("organization/gateway:cancelInvitation"),
    declineIncomingInvitation: gatewayMutation(
      "organization/gateway:declineIncomingInvitation"
    ),
    removeMember: gatewayMutation("organization/gateway:removeMember"),
    setMemberRole: gatewayMutation("organization/gateway:setMemberRole"),
    transferOwnership: gatewayMutation("organization/gateway:transferOwnership"),
    createRole: gatewayMutation("organization/gateway:createRole"),
    listRoles: gatewayQuery("organization/gateway:listRoles"),
    listAvailablePermissions: gatewayQuery(
      "organization/gateway:listAvailablePermissions"
    ),
    getRole: gatewayQuery("organization/gateway:getRole"),
    updateRole: gatewayMutation("organization/gateway:updateRole"),
    deleteRole: gatewayMutation("organization/gateway:deleteRole"),
    addDomain: gatewayMutation("organization/gateway:addDomain"),
    listDomains: gatewayQuery("organization/gateway:listDomains"),
    getDomainVerificationChallenge: gatewayQuery(
      "organization/gateway:getDomainVerificationChallenge"
    ),
    markDomainVerified: gatewayMutation("organization/gateway:markDomainVerified"),
    removeDomain: gatewayMutation("organization/gateway:removeDomain"),
    resolveOrganizationByHost: gatewayQuery(
      "organization/gateway:resolveOrganizationByHost"
    ),
    hasRole: gatewayQuery("organization/gateway:hasRole"),
    requireRole: gatewayQuery("organization/gateway:requireRole"),
    hasPermission: gatewayQuery("organization/gateway:hasPermission"),
    requirePermission: gatewayQuery("organization/gateway:requirePermission"),
  };
}

function makeOrganizationPlugin() {
  return new OrganizationPlugin(
    makeOrganizationGateway(),
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
      makeOrganizationGateway(),
      organizationPlugin({}).options,
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
        plugins: {
          organization: {
            gateway: {
              listOrganizations: "plugins/organization/gateway:listOrganizations",
              hasPermission: "plugins/organization/gateway:hasPermission",
            },
          },
        },
      },
      defineConvexZen({
        resolveUserId: async () => "resolved_user",
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
      {}
    );
    const hasPermission = await auth.plugins.organization.hasPermission(
      { runQuery },
      {
        organizationId: "org_1",
        permission: { resource: "project", action: "write" },
      }
    );

    expect(runQuery).toHaveBeenNthCalledWith(
      1,
      "plugins/organization/gateway:listOrganizations",
      {
      actorUserId: "resolved_user",
      }
    );
    expect(runQuery).toHaveBeenNthCalledWith(
      2,
      "plugins/organization/gateway:hasPermission",
      {
        actorUserId: "resolved_user",
        organizationId: "org_1",
        permission: { resource: "project", action: "write" },
      }
    );
    expect(hasPermission).toBe(true);
  });
});
