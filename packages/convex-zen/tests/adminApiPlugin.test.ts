import { describe, expect, it, vi } from "vitest";
import type { FunctionReference } from "convex/server";
import { adminApiPlugin } from "../src/client/tanstack-start-plugins";

const listUsersRef = { name: "listUsers" } as unknown as FunctionReference<
  "query",
  "public"
>;
const banUserRef = { name: "banUser" } as unknown as FunctionReference<
  "mutation",
  "public"
>;
const setRoleRef = { name: "setRole" } as unknown as FunctionReference<
  "mutation",
  "public"
>;
const unbanUserRef = { name: "unbanUser" } as unknown as FunctionReference<
  "mutation",
  "public"
>;
const deleteUserRef = { name: "deleteUser" } as unknown as FunctionReference<
  "mutation",
  "public"
>;
const customBanRef = { name: "customBan" } as unknown as FunctionReference<
  "mutation",
  "public"
>;

function jsonResponseBody(response: Response): Promise<unknown> {
  return response.json() as Promise<unknown>;
}

describe("adminApiPlugin", () => {
  it("uses authenticated fetchers for listUsers", async () => {
    const fetchAuthQuery = vi.fn(async () => ({ users: [], cursor: null, isDone: true }));
    const fetchQuery = vi.fn();
    const plugin = adminApiPlugin().create({
      tanstackAuth: {
        getSession: vi.fn(),
        getToken: vi.fn(),
        signIn: vi.fn(),
        signOut: vi.fn(),
        requireSession: vi.fn(),
        withSession: vi.fn(),
      },
      fetchers: {
        fetchQuery,
        fetchMutation: vi.fn(),
        fetchAction: vi.fn(),
        fetchAuthQuery,
        fetchAuthMutation: vi.fn(),
        fetchAuthAction: vi.fn(),
      },
      convexFunctions: {
        listUsers: listUsersRef,
        banUser: banUserRef,
        setRole: setRoleRef,
        unbanUser: unbanUserRef,
        deleteUser: deleteUserRef,
      },
    });

    const response = await plugin.handle({
      request: new Request("https://example.com/api/auth/admin/list-users", { method: "POST" }),
      method: "POST",
      action: "admin/list-users",
      readJson: async () => ({ limit: 25 }),
      json: (data, status = 200) => new Response(JSON.stringify(data), { status }),
    });

    expect(fetchQuery).not.toHaveBeenCalled();
    expect(fetchAuthQuery).toHaveBeenCalledWith(listUsersRef, { limit: 25 });
    expect(response?.status).toBe(200);
    expect(await jsonResponseBody(response as Response)).toEqual({
      users: [],
      cursor: null,
      isDone: true,
    });
  });

  it("prefers explicit convex function overrides when provided", async () => {
    const fetchAuthMutation = vi.fn(async () => ({ ok: true }));
    const fetchMutation = vi.fn();
    const plugin = adminApiPlugin({
      convexFunctions: {
        listUsers: listUsersRef,
        banUser: customBanRef,
        setRole: setRoleRef,
        unbanUser: unbanUserRef,
        deleteUser: deleteUserRef,
      },
    }).create({
      tanstackAuth: {
        getSession: vi.fn(),
        getToken: vi.fn(),
        signIn: vi.fn(),
        signOut: vi.fn(),
        requireSession: vi.fn(),
        withSession: vi.fn(),
      },
      fetchers: {
        fetchQuery: vi.fn(),
        fetchMutation,
        fetchAction: vi.fn(),
        fetchAuthQuery: vi.fn(),
        fetchAuthMutation,
        fetchAuthAction: vi.fn(),
      },
      convexFunctions: {
        listUsers: listUsersRef,
        banUser: banUserRef,
        setRole: setRoleRef,
        unbanUser: unbanUserRef,
        deleteUser: deleteUserRef,
      },
    });

    await plugin.handle({
      request: new Request("https://example.com/api/auth/admin/ban-user", { method: "POST" }),
      method: "POST",
      action: "admin/ban-user",
      readJson: async () => ({ userId: "u2", reason: "abuse" }),
      json: (data, status = 200) => new Response(JSON.stringify(data), { status }),
    });

    expect(fetchMutation).not.toHaveBeenCalled();
    expect(fetchAuthMutation).toHaveBeenCalledWith(customBanRef, {
      userId: "u2",
      reason: "abuse",
    });
  });

  it("throws a clear error if required refs cannot be resolved", () => {
    expect(() =>
      adminApiPlugin().create({
        tanstackAuth: {
          getSession: vi.fn(),
          getToken: vi.fn(),
          signIn: vi.fn(),
          signOut: vi.fn(),
          requireSession: vi.fn(),
          withSession: vi.fn(),
        },
        fetchers: {
          fetchQuery: vi.fn(),
          fetchMutation: vi.fn(),
          fetchAction: vi.fn(),
          fetchAuthQuery: vi.fn(),
          fetchAuthMutation: vi.fn(),
          fetchAuthAction: vi.fn(),
        },
        convexFunctions: {},
      })
    ).toThrow('adminApiPlugin could not resolve "listUsers" convex function');
  });

  it("throws when any admin ref is missing", () => {
    expect(() =>
      adminApiPlugin().create({
        tanstackAuth: {
          getSession: vi.fn(),
          getToken: vi.fn(),
          signIn: vi.fn(),
          signOut: vi.fn(),
          requireSession: vi.fn(),
          withSession: vi.fn(),
        },
        fetchers: {
          fetchQuery: vi.fn(),
          fetchMutation: vi.fn(),
          fetchAction: vi.fn(),
          fetchAuthQuery: vi.fn(),
          fetchAuthMutation: vi.fn(),
          fetchAuthAction: vi.fn(),
        },
        convexFunctions: {
          listUsers: listUsersRef,
          banUser: banUserRef,
          setRole: setRoleRef,
          unbanUser: unbanUserRef,
        },
      })
    ).toThrow('adminApiPlugin could not resolve "deleteUser" convex function');
  });
});
