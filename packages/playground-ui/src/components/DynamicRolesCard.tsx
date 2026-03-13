import { useEffect, useState } from "react";
import type {
  OrganizationCapabilities,
  OrganizationRole,
} from "./organizationPlaygroundShared";

export function DynamicRolesCard(props: {
  capabilities: OrganizationCapabilities;
  roles: OrganizationRole[];
  availablePermissions: string[];
  onCreateRole: (args: {
    name: string;
    slug: string;
    permissions: string[];
  }) => Promise<void>;
  onUpdateRole: (args: {
    roleId: string;
    name?: string;
    slug?: string;
    permissions?: string[];
  }) => Promise<void>;
  onDeleteRole: (roleId: string) => Promise<void>;
}) {
  const [roleName, setRoleName] = useState("");
  const [roleSlug, setRoleSlug] = useState("");
  const [rolePermissionsInput, setRolePermissionsInput] = useState(
    props.availablePermissions[0] ?? "organization:read"
  );
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [editingRoleName, setEditingRoleName] = useState("");
  const [editingRoleSlug, setEditingRoleSlug] = useState("");
  const [editingRolePermissions, setEditingRolePermissions] = useState("");

  useEffect(() => {
    if (props.availablePermissions.length === 0) {
      return;
    }
    setRolePermissionsInput((current) =>
      current.trim().length > 0 ? current : props.availablePermissions[0]!
    );
  }, [props.availablePermissions]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    await props.onCreateRole({
      name: roleName,
      slug: roleSlug,
      permissions: rolePermissionsInput
        .split(",")
        .map((permission) => permission.trim())
        .filter((permission) => permission.length > 0),
    });
    setRoleName("");
    setRoleSlug("");
  };

  const startEditingRole = (role: OrganizationRole) => {
    setEditingRoleId(role._id);
    setEditingRoleName(role.name);
    setEditingRoleSlug(role.slug);
    setEditingRolePermissions(role.permissions.join(", "));
  };

  const cancelEditingRole = () => {
    setEditingRoleId(null);
    setEditingRoleName("");
    setEditingRoleSlug("");
    setEditingRolePermissions("");
  };

  const handleUpdateRole = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingRoleId) {
      return;
    }
    await props.onUpdateRole({
      roleId: editingRoleId,
      name: editingRoleName,
      slug: editingRoleSlug,
      permissions: editingRolePermissions
        .split(",")
        .map((permission) => permission.trim())
        .filter((permission) => permission.length > 0),
    });
    cancelEditingRole();
  };

  const canManageRoles =
    props.capabilities.canUpdateRoles || props.capabilities.canDeleteRoles;

  return (
    <div className="card">
      <h2>Dynamic roles</h2>
      {props.availablePermissions.length > 0 &&
      (props.capabilities.canReadRoles ||
        props.capabilities.canCreateRoles ||
        canManageRoles) ? (
        <p className="muted">
          Available permissions here: <code>{props.availablePermissions.join(", ")}</code>
        </p>
      ) : null}
      {props.capabilities.canCreateRoles ? (
        <form onSubmit={(event) => void handleSubmit(event)}>
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
              placeholder="project:write"
              required
            />
          </div>
          <div className="actions">
            <button className="btn-primary" type="submit">
              Create role
            </button>
          </div>
        </form>
      ) : (
        <p className="muted">You do not have permission to create custom roles.</p>
      )}

      <hr className="card-divider" />

      {props.capabilities.canReadRoles ? (
        props.roles.length === 0 ? (
          <p className="muted">No custom roles yet.</p>
        ) : (
          props.roles.map((role) => (
            <div key={role._id} className="card">
              {editingRoleId === role._id && props.capabilities.canUpdateRoles ? (
                <form onSubmit={(event) => void handleUpdateRole(event)}>
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
                      placeholder={props.availablePermissions[0] ?? "organization:read"}
                      required
                    />
                  </div>
                  <div className="actions">
                    <button className="btn-primary" type="submit">
                      Save role
                    </button>
                    <button
                      className="btn-secondary"
                      type="button"
                      onClick={cancelEditingRole}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <strong>{role.name}</strong>
                  <p className="session-detail">
                    <code>{role.slug}</code>
                  </p>
                  <p className="session-detail">
                    {role.permissions.length > 0
                      ? role.permissions.join(", ")
                      : "No permissions"}
                  </p>
                  {canManageRoles ? (
                    <div className="actions">
                      {props.capabilities.canUpdateRoles ? (
                        <button
                          className="btn-secondary"
                          type="button"
                          onClick={() => startEditingRole(role)}
                        >
                          Edit role
                        </button>
                      ) : null}
                      {props.capabilities.canDeleteRoles ? (
                        <button
                          className="btn-danger"
                          type="button"
                          onClick={() => void props.onDeleteRole(role._id)}
                        >
                          Delete role
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </>
              )}
            </div>
          ))
        )
      ) : (
        <p className="muted">You do not have permission to view custom roles.</p>
      )}
    </div>
  );
}
