import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import schema from "../src/component/schema";
import { internal } from "../src/component/_generated/api";

const modules = import.meta.glob("../src/component/**/*.*s");

function systemRole(role: "owner" | "admin" | "member") {
  return { type: "system" as const, systemRole: role };
}

async function createUser(
  t: ReturnType<typeof convexTest>,
  email: string
) {
  return await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      email,
      emailVerified: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    await ctx.db.insert("accounts", {
      userId,
      providerId: "credential",
      accountId: email,
      passwordHash: "argon2_placeholder",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    return userId;
  });
}

async function createOrganization(
  t: ReturnType<typeof convexTest>,
  actorUserId: string,
  slug: string,
  name = "Acme"
) {
  return (await t.mutation(internal.plugins.organization.createOrganization, {
    actorUserId,
    name,
    slug,
  })) as {
    organization: { _id: string; slug: string; createdByUserId: string };
    membership: {
      userId: string;
      roleType: "system" | "custom";
      roleName: string;
      systemRole?: "owner" | "admin" | "member";
      customRoleId?: string;
    };
  };
}

async function insertSystemMembership(
  t: ReturnType<typeof convexTest>,
  args: {
    organizationId: string;
    userId: string;
    systemRole: "owner" | "admin" | "member";
  }
) {
  await t.run(async (ctx) => {
    await ctx.db.insert("organizationMembers", {
      organizationId: args.organizationId as never,
      userId: args.userId as never,
      roleType: "system",
      systemRole: args.systemRole,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  });
}

describe("organization plugin", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("creates an organization, normalizes the slug, and assigns the creator as owner", async () => {
    const t = convexTest(schema, modules);
    const ownerId = await createUser(t, "owner@example.com");

    const created = await createOrganization(t, ownerId, "Acme-Inc", "Acme Inc");

    expect(created.organization.slug).toBe("acme-inc");
    expect(created.organization.createdByUserId).toBe(ownerId);
    expect(created.membership.userId).toBe(ownerId);
    expect(created.membership.roleType).toBe("system");
    expect(created.membership.roleName).toBe("owner");
    expect(created.membership.systemRole).toBe("owner");

    await expect(
      createOrganization(t, ownerId, "acme-inc", "Duplicate")
    ).rejects.toThrow("Organization slug is already in use");
  });

  it("lists organizations for a user and enforces built-in permissions", async () => {
    const t = convexTest(schema, modules);
    const ownerId = await createUser(t, "owner2@example.com");
    const adminId = await createUser(t, "admin2@example.com");
    const memberId = await createUser(t, "member2@example.com");

    const orgA = await createOrganization(t, ownerId, "org-a", "Org A");
    const orgB = await createOrganization(t, ownerId, "org-b", "Org B");

    await insertSystemMembership(t, {
      organizationId: orgA.organization._id,
      userId: adminId,
      systemRole: "admin",
    });
    await insertSystemMembership(t, {
      organizationId: orgB.organization._id,
      userId: adminId,
      systemRole: "member",
    });
    await insertSystemMembership(t, {
      organizationId: orgA.organization._id,
      userId: memberId,
      systemRole: "member",
    });

    const listed = (await t.query(internal.plugins.organization.listOrganizations, {
      actorUserId: adminId,
    })) as {
      organizations: Array<{
        organization: { slug: string };
        membership: { roleName: string };
      }>;
    };

    expect(listed.organizations).toHaveLength(2);
    expect(
      listed.organizations.map((entry) => entry.organization.slug).sort()
    ).toEqual(["org-a", "org-b"]);
    expect(
      listed.organizations.map((entry) => entry.membership.roleName).sort()
    ).toEqual(["admin", "member"]);

    await expect(
      t.mutation(internal.plugins.organization.inviteMember, {
        actorUserId: memberId,
        organizationId: orgA.organization._id,
        email: "new-user@example.com",
        role: systemRole("member"),
      })
    ).rejects.toThrow("Forbidden");

    const updated = (await t.mutation(internal.plugins.organization.updateOrganization, {
      actorUserId: adminId,
      organizationId: orgA.organization._id,
      name: "Org A Updated",
    })) as { name: string };
    expect(updated.name).toBe("Org A Updated");

    await expect(
      t.mutation(internal.plugins.organization.updateOrganization, {
        actorUserId: memberId,
        organizationId: orgA.organization._id,
        name: "Should Fail",
      })
    ).rejects.toThrow("Forbidden");
  });

  it("handles invitation creation, duplicate prevention, email matching, cancellation, and expiration", async () => {
    const t = convexTest(schema, modules);
    const ownerId = await createUser(t, "owner3@example.com");
    const invitedId = await createUser(t, "invitee@example.com");
    const wrongUserId = await createUser(t, "wrong@example.com");
    const { organization } = await createOrganization(t, ownerId, "invites-org");

    const invitation = (await t.mutation(internal.plugins.organization.inviteMember, {
      actorUserId: ownerId,
      organizationId: organization._id,
      email: "INVITEE@example.com",
      role: systemRole("member"),
    })) as {
      token: string;
      invitation: { email: string; roleName: string };
    };

    expect(invitation.invitation.email).toBe("invitee@example.com");
    expect(invitation.invitation.roleName).toBe("member");

    await expect(
      t.mutation(internal.plugins.organization.inviteMember, {
        actorUserId: ownerId,
        organizationId: organization._id,
        email: "invitee@example.com",
        role: systemRole("member"),
      })
    ).rejects.toThrow("A pending invitation already exists");

    await expect(
      t.mutation(internal.plugins.organization.acceptInvitation, {
        actorUserId: wrongUserId,
        token: invitation.token,
      })
    ).rejects.toThrow("Invitation email does not match");

    const accepted = (await t.mutation(internal.plugins.organization.acceptInvitation, {
      actorUserId: invitedId,
      token: invitation.token,
    })) as { acceptedAt?: number };
    expect(typeof accepted.acceptedAt).toBe("number");

    const membership = (await t.query(internal.plugins.organization.getMembership, {
      actorUserId: invitedId,
      organizationId: organization._id,
    })) as { roleName: string; roleType: string } | null;
    expect(membership?.roleType).toBe("system");
    expect(membership?.roleName).toBe("member");

    const incomingAfterAccept = (await t.query(
      internal.plugins.organization.listIncomingInvitations,
      {
        actorUserId: invitedId,
      }
    )) as Array<{ _id: string }>;
    expect(incomingAfterAccept).toHaveLength(0);

    const cancelled = (await t.mutation(internal.plugins.organization.inviteMember, {
      actorUserId: ownerId,
      organizationId: organization._id,
      email: "cancel@example.com",
      role: systemRole("member"),
    })) as { invitation: { _id: string } };
    const cancelledInvite = (await t.mutation(
      internal.plugins.organization.cancelInvitation,
      {
        actorUserId: ownerId,
        invitationId: cancelled.invitation._id,
      }
    )) as { cancelledAt?: number };
    expect(typeof cancelledInvite.cancelledAt).toBe("number");

    const expiring = (await t.mutation(internal.plugins.organization.inviteMember, {
      actorUserId: ownerId,
      organizationId: organization._id,
      email: "late@example.com",
      role: systemRole("member"),
      inviteExpiresInMs: 1000,
    })) as { token: string };
    const lateInviteeId = await createUser(t, "late@example.com");
    vi.advanceTimersByTime(1001);

    await expect(
      t.mutation(internal.plugins.organization.acceptInvitation, {
        actorUserId: lateInviteeId,
        token: expiring.token,
      })
    ).rejects.toThrow("Invitation has expired");
  });

  it("lists, accepts, and declines pending incoming invitations for the signed-in user", async () => {
    const t = convexTest(schema, modules);
    const ownerId = await createUser(t, "owner-incoming@example.com");
    const invitedId = await createUser(t, "invitee-incoming@example.com");
    const otherId = await createUser(t, "other-incoming@example.com");
    const { organization } = await createOrganization(t, ownerId, "incoming-org");

    await t.mutation(internal.plugins.organization.inviteMember, {
      actorUserId: ownerId,
      organizationId: organization._id,
      email: "invitee-incoming@example.com",
      role: systemRole("member"),
    });

    await t.mutation(internal.plugins.organization.inviteMember, {
      actorUserId: ownerId,
      organizationId: organization._id,
      email: "other-incoming@example.com",
      role: systemRole("admin"),
    });

    const incoming = (await t.query(
      internal.plugins.organization.listIncomingInvitations,
      {
        actorUserId: invitedId,
      }
    )) as Array<{
      email: string;
      roleName: string;
      organization: { slug: string };
    }>;

    expect(incoming).toHaveLength(1);
    expect(incoming[0]?.email).toBe("invitee-incoming@example.com");
    expect(incoming[0]?.roleName).toBe("member");
    expect(incoming[0]?.organization.slug).toBe("incoming-org");

    const otherIncoming = (await t.query(
      internal.plugins.organization.listIncomingInvitations,
      {
        actorUserId: otherId,
      }
    )) as Array<{ roleName: string }>;
    expect(otherIncoming).toHaveLength(1);
    expect(otherIncoming[0]?.roleName).toBe("admin");

    const acceptedIncoming = await t.mutation(
      internal.plugins.organization.acceptIncomingInvitation,
      {
        actorUserId: invitedId,
        invitationId: incoming[0]!._id,
      }
    );
    expect((acceptedIncoming as { acceptedAt?: number }).acceptedAt).toBeTypeOf("number");

    const acceptedMembership = (await t.query(internal.plugins.organization.getMembership, {
      actorUserId: invitedId,
      organizationId: organization._id,
    })) as { roleName: string } | null;
    expect(acceptedMembership?.roleName).toBe("member");

    const declinedIncoming = await t.mutation(
      internal.plugins.organization.declineIncomingInvitation,
      {
        actorUserId: otherId,
        invitationId: otherIncoming[0]!._id,
      }
    );
    expect((declinedIncoming as { declinedAt?: number }).declinedAt).toBeTypeOf("number");

    const incomingAfterResolution = (await t.query(
      internal.plugins.organization.listIncomingInvitations,
      {
        actorUserId: invitedId,
      }
    )) as Array<{ _id: string }>;
    expect(incomingAfterResolution).toHaveLength(0);

    const otherIncomingAfterDecline = (await t.query(
      internal.plugins.organization.listIncomingInvitations,
      {
        actorUserId: otherId,
      }
    )) as Array<{ _id: string }>;
    expect(otherIncomingAfterDecline).toHaveLength(0);
  });

  it("preserves a single owner and requires transferOwnership for owner changes", async () => {
    const t = convexTest(schema, modules);
    const ownerId = await createUser(t, "owner4@example.com");
    const memberId = await createUser(t, "member4@example.com");
    const { organization } = await createOrganization(t, ownerId, "owners-org");

    await insertSystemMembership(t, {
      organizationId: organization._id,
      userId: memberId,
      systemRole: "member",
    });

    await expect(
      t.mutation(internal.plugins.organization.removeMember, {
        actorUserId: ownerId,
        organizationId: organization._id,
        userId: ownerId,
      })
    ).rejects.toThrow("owner cannot leave");

    await expect(
      t.mutation(internal.plugins.organization.setMemberRole, {
        actorUserId: ownerId,
        organizationId: organization._id,
        userId: memberId,
        role: systemRole("owner"),
      })
    ).rejects.toThrow("transferOwnership");

    await t.mutation(internal.plugins.organization.transferOwnership, {
      actorUserId: ownerId,
      organizationId: organization._id,
      newOwnerUserId: memberId,
    });

    const ownerMembership = (await t.query(internal.plugins.organization.getMembership, {
      actorUserId: ownerId,
      organizationId: organization._id,
    })) as { roleName: string } | null;
    const newOwnerMembership = (await t.query(
      internal.plugins.organization.getMembership,
      {
        actorUserId: memberId,
        organizationId: organization._id,
      }
    )) as { roleName: string } | null;

    expect(ownerMembership?.roleName).toBe("admin");
    expect(newOwnerMembership?.roleName).toBe("owner");
  });

  it("supports dynamic custom roles and enforces their permissions at runtime", async () => {
    const t = convexTest(schema, modules);
    const ownerId = await createUser(t, "owner-custom@example.com");
    const billingAdminId = await createUser(t, "billing-admin@example.com");
    const { organization } = await createOrganization(t, ownerId, "custom-role-org");

    await insertSystemMembership(t, {
      organizationId: organization._id,
      userId: billingAdminId,
      systemRole: "member",
    });

    const createdRole = (await t.mutation(internal.plugins.organization.createRole, {
      actorUserId: ownerId,
      organizationId: organization._id,
      name: "Billing Admin",
      slug: "billing-admin",
      permissions: ["billing:read"],
    })) as { _id: string; slug: string; permissions: string[] };

    expect(createdRole.slug).toBe("billing-admin");
    expect(createdRole.permissions).toEqual(["billing:read"]);

    const listedRoles = (await t.query(internal.plugins.organization.listRoles, {
      actorUserId: ownerId,
      organizationId: organization._id,
    })) as { roles: Array<{ slug: string }> };
    expect(listedRoles.roles.map((role) => role.slug)).toContain("billing-admin");

    await t.mutation(internal.plugins.organization.setMemberRole, {
      actorUserId: ownerId,
      organizationId: organization._id,
      userId: billingAdminId,
      role: {
        type: "custom",
        customRoleId: createdRole._id,
      },
    });

    const membership = (await t.query(internal.plugins.organization.getMembership, {
      actorUserId: billingAdminId,
      organizationId: organization._id,
    })) as {
      roleType: "system" | "custom";
      roleName: string;
      customRoleId?: string;
    } | null;

    expect(membership?.roleType).toBe("custom");
    expect(membership?.roleName).toBe("billing-admin");
    expect(membership?.customRoleId).toBe(createdRole._id);

    await expect(
      t.query(internal.plugins.organization.requirePermission, {
        actorUserId: billingAdminId,
        organizationId: organization._id,
        permission: {
          resource: "billing",
          action: "read",
        },
      })
    ).resolves.toMatchObject({
      roleName: "billing-admin",
    });

    await expect(
      t.query(internal.plugins.organization.requirePermission, {
        actorUserId: billingAdminId,
        organizationId: organization._id,
        permission: {
          resource: "billing",
          action: "write",
        },
      })
    ).rejects.toThrow("Forbidden");

    const hasRole = await t.query(internal.plugins.organization.hasRole, {
      actorUserId: billingAdminId,
      organizationId: organization._id,
      role: "billing-admin",
    });
    expect(hasRole).toBe(true);

    await expect(
      t.mutation(internal.plugins.organization.deleteRole, {
        actorUserId: ownerId,
        roleId: createdRole._id,
      })
    ).rejects.toThrow("members are assigned");

    await t.mutation(internal.plugins.organization.setMemberRole, {
      actorUserId: ownerId,
      organizationId: organization._id,
      userId: billingAdminId,
      role: systemRole("member"),
    });

    await t.mutation(internal.plugins.organization.deleteRole, {
      actorUserId: ownerId,
      roleId: createdRole._id,
    });

    const deletedRole = await t.query(internal.plugins.organization.getRole, {
      actorUserId: ownerId,
      roleId: createdRole._id,
    });
    expect(deletedRole).toBeNull();
  });

  it("lists available permissions for owners and admins but denies members", async () => {
    const t = convexTest(schema, modules);
    const ownerId = await createUser(t, "owner-acl@example.com");
    const adminId = await createUser(t, "admin-acl@example.com");
    const memberId = await createUser(t, "member-acl@example.com");
    const { organization } = await createOrganization(t, ownerId, "acl-org");

    await insertSystemMembership(t, {
      organizationId: organization._id,
      userId: adminId,
      systemRole: "admin",
    });
    await insertSystemMembership(t, {
      organizationId: organization._id,
      userId: memberId,
      systemRole: "member",
    });

    const ownerPermissions = (await t.query(
      internal.plugins.organization.listAvailablePermissions,
      {
        actorUserId: ownerId,
        organizationId: organization._id,
        accessControl: {
          organization: ["read", "update", "delete", "transfer"],
          accessControl: ["read"],
          role: ["read", "create", "update", "delete"],
          member: ["read", "create", "update", "delete"],
          invitation: ["read", "create", "cancel", "accept"],
          domain: ["read", "create", "verify", "delete"],
          project: ["write"],
        },
        rolePermissions: {
          owner: ["organization:read", "accessControl:read"],
          admin: ["organization:read", "accessControl:read"],
          member: ["organization:read"],
        },
      }
    )) as {
      resources: Record<string, string[]>;
      permissions: string[];
    };

    expect(ownerPermissions.resources.accessControl).toEqual(["read"]);
    expect(ownerPermissions.resources.project).toEqual(["write"]);
    expect(ownerPermissions.permissions).toContain("accessControl:read");
    expect(ownerPermissions.permissions).toContain("project:write");

    const adminPermissions = (await t.query(
      internal.plugins.organization.listAvailablePermissions,
      {
        actorUserId: adminId,
        organizationId: organization._id,
        accessControl: {
          organization: ["read", "update", "delete", "transfer"],
          accessControl: ["read"],
          role: ["read", "create", "update", "delete"],
          member: ["read", "create", "update", "delete"],
          invitation: ["read", "create", "cancel", "accept"],
          domain: ["read", "create", "verify", "delete"],
        },
        rolePermissions: {
          owner: ["organization:read", "accessControl:read"],
          admin: ["organization:read", "accessControl:read"],
          member: ["organization:read"],
        },
      }
    )) as {
      permissions: string[];
    };
    expect(adminPermissions.permissions).toContain("accessControl:read");

    await expect(
      t.query(internal.plugins.organization.listAvailablePermissions, {
        actorUserId: memberId,
        organizationId: organization._id,
        accessControl: {
          organization: ["read", "update", "delete", "transfer"],
          accessControl: ["read"],
          role: ["read", "create", "update", "delete"],
          member: ["read", "create", "update", "delete"],
          invitation: ["read", "create", "cancel", "accept"],
          domain: ["read", "create", "verify", "delete"],
        },
        rolePermissions: {
          owner: ["organization:read", "accessControl:read"],
          admin: ["organization:read", "accessControl:read"],
          member: ["organization:read"],
        },
      })
    ).rejects.toThrow("Forbidden");
  });

  it("deletes organizations with cascading members, invitations, custom roles, and domains", async () => {
    const t = convexTest(schema, modules);
    const ownerId = await createUser(t, "owner5@example.com");
    const memberId = await createUser(t, "member5@example.com");
    const { organization } = await createOrganization(t, ownerId, "delete-org");

    await insertSystemMembership(t, {
      organizationId: organization._id,
      userId: memberId,
      systemRole: "member",
    });

    const role = (await t.mutation(internal.plugins.organization.createRole, {
      actorUserId: ownerId,
      organizationId: organization._id,
      name: "Project Editor",
      slug: "project-editor",
      permissions: ["project:write"],
    })) as { _id: string };

    await t.mutation(internal.plugins.organization.inviteMember, {
      actorUserId: ownerId,
      organizationId: organization._id,
      email: "pending-member5@example.com",
      role: systemRole("member"),
    });

    const domain = (await t.mutation(internal.plugins.organization.addDomain, {
      actorUserId: ownerId,
      organizationId: organization._id,
      hostname: "app.delete-org.test",
    })) as { _id: string };

    await t.mutation(internal.plugins.organization.deleteOrganization, {
      actorUserId: ownerId,
      organizationId: organization._id,
    });

    const counts = await t.run(async (ctx) => {
      const org = await ctx.db.get(organization._id as never);
      const members = await ctx.db
        .query("organizationMembers")
        .withIndex("by_organizationId", (q) =>
          q.eq("organizationId", organization._id as never)
        )
        .collect();
      const invites = await ctx.db
        .query("organizationInvitations")
        .withIndex("by_organizationId", (q) =>
          q.eq("organizationId", organization._id as never)
        )
        .collect();
      const roles = await ctx.db
        .query("organizationRoles")
        .withIndex("by_organizationId", (q) =>
          q.eq("organizationId", organization._id as never)
        )
        .collect();
      const domains = await ctx.db
        .query("organizationDomains")
        .withIndex("by_organizationId", (q) =>
          q.eq("organizationId", organization._id as never)
        )
        .collect();
      return { org, members, invites, roles, domains };
    });

    expect(role._id).toBeDefined();
    expect(domain._id).toBeDefined();
    expect(counts.org).toBeNull();
    expect(counts.members).toHaveLength(0);
    expect(counts.invites).toHaveLength(0);
    expect(counts.roles).toHaveLength(0);
    expect(counts.domains).toHaveLength(0);
  });

  it("resolves organizations by verified custom domain and configured subdomain suffix", async () => {
    const t = convexTest(schema, modules);
    const ownerId = await createUser(t, "owner6@example.com");
    const { organization } = await createOrganization(t, ownerId, "domain-org");

    const domain = (await t.mutation(internal.plugins.organization.addDomain, {
      actorUserId: ownerId,
      organizationId: organization._id,
      hostname: "portal.domain-org.test",
    })) as { _id: string };

    const unresolved = await t.query(internal.plugins.organization.resolveOrganizationByHost, {
      host: "portal.domain-org.test",
    });
    expect(unresolved).toBeNull();

    await t.mutation(internal.plugins.organization.markDomainVerified, {
      actorUserId: ownerId,
      domainId: domain._id,
    });

    const resolvedByDomain = (await t.query(
      internal.plugins.organization.resolveOrganizationByHost,
      {
        host: "portal.domain-org.test",
      }
    )) as { slug: string } | null;
    expect(resolvedByDomain?.slug).toBe("domain-org");

    const resolvedBySubdomain = (await t.query(
      internal.plugins.organization.resolveOrganizationByHost,
      {
        host: "domain-org.example.com",
        subdomainSuffix: "example.com",
      }
    )) as { slug: string } | null;
    expect(resolvedBySubdomain?.slug).toBe("domain-org");
  });

  it("blocks deleting a user who still owns an organization with other members", async () => {
    const t = convexTest(schema, modules);
    const ownerId = await createUser(t, "owner7@example.com");
    const memberId = await createUser(t, "member7@example.com");
    const { organization } = await createOrganization(t, ownerId, "user-delete-org");

    await insertSystemMembership(t, {
      organizationId: organization._id,
      userId: memberId,
      systemRole: "member",
    });

    await expect(
      t.mutation(internal.core.users.remove, {
        userId: ownerId,
      })
    ).rejects.toThrow("Transfer ownership first");
  });
});
