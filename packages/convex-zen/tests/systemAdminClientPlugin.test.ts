import { describe, expect, it, vi } from "vitest";
import { SystemAdminPlugin } from "../../convex-zen-system-admin/src";

function makePlugin() {
  return new SystemAdminPlugin(
    {
      systemAdmin: {
        gateway: {
          isAdmin: "system-admin/gateway:isAdmin",
          listUsers: "system-admin/gateway:listUsers",
          banUser: "system-admin/gateway:banUser",
          unbanUser: "system-admin/gateway:unbanUser",
          setRole: "system-admin/gateway:setRole",
          deleteUser: "system-admin/gateway:deleteUser",
        },
      },
    },
    { id: "systemAdmin" }
  );
}

describe("SystemAdminPlugin client", () => {
  it("calls isAdmin with actor identity payload", async () => {
    const plugin = makePlugin();
    const runQuery = vi.fn(async () => true);

    const result = await plugin.isAdmin(
      { runQuery },
      { actorUserId: "user_admin" }
    );

    expect(result).toBe(true);
    expect(runQuery).toHaveBeenCalledTimes(1);
    expect(runQuery).toHaveBeenCalledWith("system-admin/gateway:isAdmin", {
      adminRole: "admin",
    });
  });

  it("calls listUsers with actor identity payload", async () => {
    const plugin = makePlugin();
    const runQuery = vi.fn(async () => ({ users: [], cursor: null, isDone: true }));

    await plugin.listUsers(
      { runQuery },
      { actorUserId: "user_admin", limit: 20, cursor: "c1" }
    );

    expect(runQuery).toHaveBeenCalledTimes(1);
    expect(runQuery).toHaveBeenCalledWith("system-admin/gateway:listUsers", {
      limit: 20,
      cursor: "c1",
      adminRole: "admin",
    });
  });

  it("calls setRole with actor identity payload", async () => {
    const plugin = makePlugin();
    const runMutation = vi.fn(async () => undefined);

    await plugin.setRole(
      { runMutation },
      { actorUserId: "user_admin", userId: "user_1", role: "admin" }
    );

    expect(runMutation).toHaveBeenCalledTimes(1);
    expect(runMutation).toHaveBeenCalledWith("system-admin/gateway:setRole", {
      userId: "user_1",
      role: "admin",
      adminRole: "admin",
    });
  });

  it("forwards configured adminRole to gateway in app runtime mode", async () => {
    const plugin = new SystemAdminPlugin(
      {
        systemAdmin: {
          gateway: {
            isAdmin: "system-admin/gateway:isAdmin",
          },
        },
      },
      { id: "systemAdmin", adminRole: "superadmin" }
    );
    const runQuery = vi.fn(async () => true);

    await plugin.isAdmin({ runQuery }, { actorUserId: "user_admin" });

    expect(runQuery).toHaveBeenCalledWith("system-admin/gateway:isAdmin", {
      adminRole: "superadmin",
    });
  });

  it("routes through component child refs in component runtime mode", async () => {
    const plugin = new SystemAdminPlugin(
      {
        systemAdminComponent: {
          gateway: {
            isAdmin: "systemAdminComponent/gateway:isAdmin",
          },
        },
      },
      { id: "systemAdmin" },
      "systemAdminComponent",
      "component"
    );
    const runQuery = vi.fn(async () => true);

    await plugin.isAdmin({ runQuery }, { actorUserId: "user_admin" });

    expect(runQuery).toHaveBeenCalledWith("systemAdminComponent/gateway:isAdmin", {
      actorUserId: "user_admin",
      adminRole: "admin",
    });
  });
});
