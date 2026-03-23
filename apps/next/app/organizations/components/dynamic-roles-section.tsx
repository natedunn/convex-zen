"use client";

import { useEffect, useState } from "react";
import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "../../../convex/_generated/api";
import {
  EMPTY_PERMISSION_LIST,
  messageFromError,
  type OrganizationPermissionList,
  type OrganizationRole,
  type OrganizationRoleListResult,
} from "./organization-playground-shared";

export function DynamicRolesSection({
  organizationId,
}: {
  organizationId: string;
}) {
  const rolesQuery = useQuery(
    convexQuery(api.zen.plugin.organization.listRoles, { organizationId })
  );
  const permissionsQuery = useQuery(
    convexQuery(api.zen.plugin.organization.listAvailablePermissions, {
      organizationId,
    })
  );
  const canCreateRoleQuery = useQuery(
    convexQuery(api.zen.plugin.organization.hasPermission, {
      organizationId,
      permission: { resource: "role", action: "create" },
    })
  );
  const canUpdateRoleQuery = useQuery(
    convexQuery(api.zen.plugin.organization.hasPermission, {
      organizationId,
      permission: { resource: "role", action: "update" },
    })
  );
  const canDeleteRoleQuery = useQuery(
    convexQuery(api.zen.plugin.organization.hasPermission, {
      organizationId,
      permission: { resource: "role", action: "delete" },
    })
  );

  const roles =
    ((rolesQuery.data as OrganizationRoleListResult | undefined)?.roles ?? []);
  const availablePermissions =
    (
      (permissionsQuery.data as OrganizationPermissionList | undefined) ??
      EMPTY_PERMISSION_LIST
    ).permissions;
  const canCreateRole = canCreateRoleQuery.data ?? false;
  const canUpdateRole = canUpdateRoleQuery.data ?? false;
  const canDeleteRole = canDeleteRoleQuery.data ?? false;

  const [roleName, setRoleName] = useState("");
  const [roleSlug, setRoleSlug] = useState("");
  const [rolePermissionsInput, setRolePermissionsInput] =
    useState("organization:read");
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [editingRoleName, setEditingRoleName] = useState("");
  const [editingRoleSlug, setEditingRoleSlug] = useState("");
  const [editingRolePermissions, setEditingRolePermissions] = useState("");

  const resetEditor = () => {
    setEditingRoleId(null);
    setEditingRoleName("");
    setEditingRoleSlug("");
    setEditingRolePermissions("");
  };

  useEffect(() => {
    if (!editingRoleId) {
      setRolePermissionsInput((current) =>
        current.trim() ? current : availablePermissions[0] ?? "organization:read"
      );
    }
  }, [availablePermissions, editingRoleId]);

  const refresh = () => {
    void Promise.all([rolesQuery.refetch(), permissionsQuery.refetch()]);
  };

  const createRoleMutation = useMutation({
    mutationFn: useConvexMutation(api.zen.plugin.organization.createRole),
    onSuccess: () => {
      setRoleName("");
      setRoleSlug("");
      refresh();
    },
  });
  const updateRoleMutation = useMutation({
    mutationFn: useConvexMutation(api.zen.plugin.organization.updateRole),
    onSuccess: () => {
      resetEditor();
      refresh();
    },
  });
  const deleteRoleMutation = useMutation({
    mutationFn: useConvexMutation(api.zen.plugin.organization.deleteRole),
    onSuccess: () => {
      refresh();
    },
  });

  return (
    <div className="card">
      <h2>Dynamic roles</h2>
      {rolesQuery.error ? (
        <p className="text-error">
          {messageFromError(rolesQuery.error, "Could not load roles")}
        </p>
      ) : null}
      {createRoleMutation.error ? (
        <p className="text-error">
          {messageFromError(createRoleMutation.error, "Could not create role")}
        </p>
      ) : null}
      {updateRoleMutation.error ? (
        <p className="text-error">
          {messageFromError(updateRoleMutation.error, "Could not update role")}
        </p>
      ) : null}
      {deleteRoleMutation.error ? (
        <p className="text-error">
          {messageFromError(deleteRoleMutation.error, "Could not delete role")}
        </p>
      ) : null}
      {createRoleMutation.isSuccess ? (
        <p className="text-success">Role created</p>
      ) : null}
      {updateRoleMutation.isSuccess ? (
        <p className="text-success">Role updated</p>
      ) : null}
      {deleteRoleMutation.isSuccess ? (
        <p className="text-success">Role deleted</p>
      ) : null}
      {rolesQuery.isLoading ? <p className="loading-text">Loading roles...</p> : null}

      {availablePermissions.length > 0 ? (
        <p className="muted">
          Available permissions: <code>{availablePermissions.join(", ")}</code>
        </p>
      ) : null}

      {canCreateRole ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            createRoleMutation.mutate({
              organizationId,
              name: roleName,
              slug: roleSlug,
              permissions: rolePermissionsInput
                .split(",")
                .map((permission) => permission.trim())
                .filter(Boolean),
            });
          }}
        >
          <div className="field">
            <label htmlFor="role-name">Role name</label>
            <input
              id="role-name"
              value={roleName}
              onChange={(event) => setRoleName(event.target.value)}
              placeholder="Project Editor"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="role-slug">Role slug</label>
            <input
              id="role-slug"
              value={roleSlug}
              onChange={(event) => setRoleSlug(event.target.value)}
              placeholder="project-editor"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="role-permissions">Permissions (comma-separated)</label>
            <input
              id="role-permissions"
              value={rolePermissionsInput}
              onChange={(event) => setRolePermissionsInput(event.target.value)}
              placeholder={availablePermissions[0] ?? "organization:read"}
              required
            />
          </div>
          <div className="actions">
            <button
              className="btn-primary"
              type="submit"
              disabled={createRoleMutation.isPending}
            >
              {createRoleMutation.isPending ? "Creating..." : "Create role"}
            </button>
          </div>
        </form>
      ) : (
        <p className="muted">You do not have permission to create custom roles.</p>
      )}

      <hr className="card-divider" />

      {rolesQuery.isError ? (
        <p className="muted">You do not have permission to view roles.</p>
      ) : roles.length === 0 ? (
        <p className="muted">No custom roles yet.</p>
      ) : (
        roles.map((role: OrganizationRole) => (
          <div key={role._id} className="card">
            {editingRoleId === role._id && canUpdateRole ? (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!editingRoleId) {
                    return;
                  }
                  updateRoleMutation.mutate({
                    roleId: editingRoleId,
                    name: editingRoleName,
                    slug: editingRoleSlug,
                    permissions: editingRolePermissions
                      .split(",")
                      .map((permission) => permission.trim())
                      .filter(Boolean),
                  });
                }}
              >
                <div className="field">
                  <label htmlFor={`edit-role-name-${role._id}`}>Role name</label>
                  <input
                    id={`edit-role-name-${role._id}`}
                    value={editingRoleName}
                    onChange={(event) => setEditingRoleName(event.target.value)}
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor={`edit-role-slug-${role._id}`}>Role slug</label>
                  <input
                    id={`edit-role-slug-${role._id}`}
                    value={editingRoleSlug}
                    onChange={(event) => setEditingRoleSlug(event.target.value)}
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor={`edit-role-permissions-${role._id}`}>
                    Permissions (comma-separated)
                  </label>
                  <input
                    id={`edit-role-permissions-${role._id}`}
                    value={editingRolePermissions}
                    onChange={(event) =>
                      setEditingRolePermissions(event.target.value)
                    }
                    required
                  />
                </div>
                <div className="actions">
                  <button
                    className="btn-secondary"
                    type="submit"
                    disabled={updateRoleMutation.isPending}
                  >
                    {updateRoleMutation.isPending ? "Saving..." : "Save role"}
                  </button>
                  <button
                    className="btn-secondary"
                    type="button"
                    onClick={resetEditor}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <>
                <strong>{role.name}</strong>
                <p className="session-detail">
                  <strong>Slug:</strong> <code>{role.slug}</code>
                </p>
                <p className="session-detail">
                  <strong>Permissions:</strong>{" "}
                  {role.permissions.length > 0
                    ? role.permissions.join(", ")
                    : "None"}
                </p>
                <div className="actions">
                  {canUpdateRole ? (
                    <button
                      className="btn-secondary"
                      type="button"
                      disabled={updateRoleMutation.isPending}
                      onClick={() => {
                        setEditingRoleId(role._id);
                        setEditingRoleName(role.name);
                        setEditingRoleSlug(role.slug);
                        setEditingRolePermissions(role.permissions.join(", "));
                      }}
                    >
                      Edit role
                    </button>
                  ) : null}
                  {canDeleteRole ? (
                    <button
                      className="btn-danger"
                      type="button"
                      disabled={deleteRoleMutation.isPending}
                      onClick={() => deleteRoleMutation.mutate({ roleId: role._id })}
                    >
                      Delete role
                    </button>
                  ) : null}
                </div>
              </>
            )}
          </div>
        ))
      )}
    </div>
  );
}
