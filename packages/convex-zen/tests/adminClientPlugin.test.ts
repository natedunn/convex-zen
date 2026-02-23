import { describe, expect, it, vi } from "vitest";
import { AdminPlugin } from "../src/client/plugins/admin";

function makePlugin() {
  return new AdminPlugin(
    {
      gateway: {
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

describe("AdminPlugin client compatibility", () => {
  it("sends adminToken first for listUsers", async () => {
    const plugin = makePlugin();
    const runAction = vi.fn(async () => ({ users: [], cursor: null, isDone: true }));

    await plugin.listUsers({ runAction }, { adminToken: "tok", limit: 20 });

    expect(runAction).toHaveBeenCalledTimes(1);
    expect(runAction).toHaveBeenCalledWith("gateway:adminListUsers", {
      adminToken: "tok",
      limit: 20,
    });
  });

  it("falls back to tokenless payload if adminToken is rejected", async () => {
    const plugin = makePlugin();
    const runAction = vi
      .fn()
      .mockRejectedValueOnce(
        new Error("ArgumentValidationError: Object contains extra field `adminToken`")
      )
      .mockResolvedValueOnce({ users: [], cursor: null, isDone: true });

    await plugin.listUsers({ runAction }, { adminToken: "tok", limit: 10 });

    expect(runAction).toHaveBeenCalledTimes(2);
    expect(runAction).toHaveBeenNthCalledWith(2, "gateway:adminListUsers", {
      limit: 10,
    });
  });

  it("falls back to token as last resort", async () => {
    const plugin = makePlugin();
    const runAction = vi
      .fn()
      .mockRejectedValueOnce(
        new Error("ArgumentValidationError: Object contains extra field `adminToken`")
      )
      .mockRejectedValueOnce(
        new Error("ArgumentValidationError: Missing required field `adminToken`")
      )
      .mockResolvedValueOnce({ users: [], cursor: null, isDone: true });

    await plugin.listUsers({ runAction }, { adminToken: "tok", limit: 5, cursor: "c1" });

    expect(runAction).toHaveBeenCalledTimes(3);
    expect(runAction).toHaveBeenNthCalledWith(3, "gateway:adminListUsers", {
      token: "tok",
      limit: 5,
      cursor: "c1",
    });
  });

  it("still reaches tokenless fallback when token is also rejected", async () => {
    const plugin = makePlugin();
    const runAction = vi
      .fn()
      .mockRejectedValueOnce(
        new Error("ArgumentValidationError: Object contains extra field `adminToken`")
      )
      .mockResolvedValueOnce({ users: [], cursor: null, isDone: true });

    await plugin.listUsers({ runAction }, { adminToken: "tok", limit: 5, cursor: "c1" });

    expect(runAction).toHaveBeenCalledTimes(2);
    expect(runAction).toHaveBeenNthCalledWith(2, "gateway:adminListUsers", {
      limit: 5,
      cursor: "c1",
    });
  });

  it("falls back when ConvexError puts details in data instead of message", async () => {
    const plugin = makePlugin();
    const runAction = vi
      .fn()
      .mockRejectedValueOnce({
        message: "Server Error",
        data: "ArgumentValidationError: Object contains extra field `adminToken`",
      })
      .mockRejectedValueOnce({
        message: "Server Error",
        data: "ArgumentValidationError: Missing required field `adminToken`",
      })
      .mockResolvedValueOnce({ users: [], cursor: null, isDone: true });

    await plugin.listUsers({ runAction }, { adminToken: "tok", limit: 5, cursor: "c1" });

    expect(runAction).toHaveBeenCalledTimes(3);
    expect(runAction).toHaveBeenNthCalledWith(3, "gateway:adminListUsers", {
      token: "tok",
      limit: 5,
      cursor: "c1",
    });
  });

  it("falls back when runAction only returns generic Server Error", async () => {
    const plugin = makePlugin();
    const runAction = vi
      .fn()
      .mockRejectedValueOnce(new Error("Server Error"))
      .mockRejectedValueOnce(new Error("Server Error"))
      .mockResolvedValueOnce({ users: [], cursor: null, isDone: true });

    await plugin.listUsers({ runAction }, { adminToken: "tok", limit: 5, cursor: "c1" });

    expect(runAction).toHaveBeenCalledTimes(3);
    expect(runAction).toHaveBeenNthCalledWith(3, "gateway:adminListUsers", {
      token: "tok",
      limit: 5,
      cursor: "c1",
    });
  });

  it("accepts legacy token argument from callers", async () => {
    const plugin = makePlugin();
    const runAction = vi.fn(async () => undefined);

    await plugin.setRole(
      { runAction },
      { token: "tok", userId: "user_1", role: "admin" }
    );

    expect(runAction).toHaveBeenCalledWith("gateway:adminSetRole", {
      adminToken: "tok",
      userId: "user_1",
      role: "admin",
    });
  });

  it("throws when no admin token is provided", async () => {
    const plugin = makePlugin();
    const runAction = vi.fn(async () => undefined);

    await expect(
      plugin.banUser({ runAction }, { userId: "user_1", reason: "r" })
    ).rejects.toThrow("adminToken is required");
    expect(runAction).not.toHaveBeenCalled();
  });
});
