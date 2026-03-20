import { describe, expect, it, vi } from "vitest";
import { AdminPlugin } from "../src/client/plugins/admin";

function makePlugin() {
  return new AdminPlugin(
    {
      admin: {
        gateway: {
          isAdmin: "admin/gateway:isAdmin",
          listUsers: "admin/gateway:listUsers",
          banUser: "admin/gateway:banUser",
          unbanUser: "admin/gateway:unbanUser",
          setRole: "admin/gateway:setRole",
          deleteUser: "admin/gateway:deleteUser",
        },
      },
    },
    { id: "admin" }
  );
}

describe("AdminPlugin client", () => {
  it("calls isAdmin with actor identity payload", async () => {
    const plugin = makePlugin();
    const runQuery = vi.fn(async () => true);

    const result = await plugin.isAdmin(
      { runQuery },
      { actorUserId: "user_admin" }
    );

    expect(result).toBe(true);
    expect(runQuery).toHaveBeenCalledTimes(1);
    expect(runQuery).toHaveBeenCalledWith("admin/gateway:isAdmin", {
      actorUserId: "user_admin",
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
    expect(runQuery).toHaveBeenCalledWith("admin/gateway:listUsers", {
      actorUserId: "user_admin",
      limit: 20,
      cursor: "c1",
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
    expect(runMutation).toHaveBeenCalledWith("admin/gateway:setRole", {
      actorUserId: "user_admin",
      userId: "user_1",
      role: "admin",
    });
  });

  it("routes through component child refs in component runtime mode", async () => {
    const plugin = new AdminPlugin(
      {
        adminComponent: {
          gateway: {
            isAdmin: "adminComponent/gateway:isAdmin",
          },
        },
      },
      { id: "admin" },
      "adminComponent",
      "component"
    );
    const runQuery = vi.fn(async () => true);

    await plugin.isAdmin({ runQuery }, { actorUserId: "user_admin" });

    expect(runQuery).toHaveBeenCalledWith("adminComponent/gateway:isAdmin", {
      actorUserId: "user_admin",
      adminRole: "admin",
    });
  });
});
