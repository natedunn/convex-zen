import { describe, expect, it, vi } from "vitest";
import { SystemAdminPlugin } from "../src/plugins/system-admin/runtime";

function makeGateway() {
  return {
    isAdmin: vi.fn(async () => true),
    canBootstrapAdmin: vi.fn(async () => false),
    bootstrapAdmin: vi.fn(async () => true),
    listUsers: vi.fn(async () => ({ users: [], cursor: null, isDone: true })),
    banUser: vi.fn(async () => undefined),
    unbanUser: vi.fn(async () => undefined),
    setRole: vi.fn(async () => undefined),
    deleteUser: vi.fn(async () => undefined),
  };
}

describe("SystemAdminPlugin client", () => {
  it("calls isAdmin with configured adminRole", async () => {
    const gateway = makeGateway();
    const plugin = new SystemAdminPlugin(gateway, { adminRole: "admin" });
    const ctx = { runQuery: vi.fn() };

    await expect(plugin.isAdmin(ctx)).resolves.toBe(true);

    expect(gateway.isAdmin).toHaveBeenCalledTimes(1);
    expect(gateway.isAdmin).toHaveBeenCalledWith(ctx, {
      adminRole: "admin",
    });
  });

  it("calls bootstrap helpers with configured adminRole", async () => {
    const gateway = makeGateway();
    const plugin = new SystemAdminPlugin(gateway, { adminRole: "admin" });
    const queryCtx = { runQuery: vi.fn() };
    const mutationCtx = { runMutation: vi.fn() };

    await expect(plugin.canBootstrapAdmin(queryCtx)).resolves.toBe(false);
    await expect(plugin.bootstrapAdmin(mutationCtx)).resolves.toBe(true);

    expect(gateway.canBootstrapAdmin).toHaveBeenCalledWith(queryCtx, {
      adminRole: "admin",
    });
    expect(gateway.bootstrapAdmin).toHaveBeenCalledWith(mutationCtx, {
      adminRole: "admin",
    });
  });

  it("calls listUsers without forwarding actorUserId", async () => {
    const gateway = makeGateway();
    const plugin = new SystemAdminPlugin(gateway, { adminRole: "admin" });
    const ctx = { runQuery: vi.fn() };

    await plugin.listUsers(ctx, {
      actorUserId: "user_admin",
      limit: 20,
      cursor: "c1",
    });

    expect(gateway.listUsers).toHaveBeenCalledTimes(1);
    expect(gateway.listUsers).toHaveBeenCalledWith(ctx, {
      limit: 20,
      cursor: "c1",
      adminRole: "admin",
    });
  });

  it("calls setRole with sanitized payload", async () => {
    const gateway = makeGateway();
    const plugin = new SystemAdminPlugin(gateway, {});
    const ctx = { runMutation: vi.fn() };

    await plugin.setRole(ctx, {
      actorUserId: "user_admin",
      userId: "user_1",
      role: "admin",
    });

    expect(gateway.setRole).toHaveBeenCalledTimes(1);
    expect(gateway.setRole).toHaveBeenCalledWith(ctx, {
      userId: "user_1",
      role: "admin",
      adminRole: "admin",
    });
  });

  it("forwards custom adminRole to all mutations", async () => {
    const gateway = makeGateway();
    const plugin = new SystemAdminPlugin(gateway, { adminRole: "superadmin" });
    const ctx = { runMutation: vi.fn() };

    await plugin.deleteUser(ctx, {
      actorUserId: "user_admin",
      userId: "user_1",
    });

    expect(gateway.deleteUser).toHaveBeenCalledWith(ctx, {
      userId: "user_1",
      adminRole: "superadmin",
    });
  });
});
