import { describe, expect, it, vi } from "vitest";
import { AdminPlugin } from "../src/client/plugins/admin";

function makePlugin() {
  return new AdminPlugin(
    {
      gateway: {
        adminIsAdmin: "gateway:adminIsAdmin",
        adminListUsers: "gateway:adminListUsers",
        adminBanUser: "gateway:adminBanUser",
        adminUnbanUser: "gateway:adminUnbanUser",
        adminSetRole: "gateway:adminSetRole",
        adminDeleteUser: "gateway:adminDeleteUser",
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
    expect(runQuery).toHaveBeenCalledWith("gateway:adminIsAdmin", {
      actorUserId: "user_admin",
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
    expect(runQuery).toHaveBeenCalledWith("gateway:adminListUsers", {
      actorUserId: "user_admin",
      adminRole: "admin",
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
    expect(runMutation).toHaveBeenCalledWith("gateway:adminSetRole", {
      actorUserId: "user_admin",
      adminRole: "admin",
      userId: "user_1",
      role: "admin",
    });
  });
});
