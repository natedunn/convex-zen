import { useEffect, useState } from "react";
import type { OrganizationPlaygroundClient } from "./organizationPlaygroundShared";

export function PermissionProbeCard(props: {
  organizationClient: OrganizationPlaygroundClient;
  organizationId: string;
  availablePermissions: string[];
}) {
  const initialPermission = props.availablePermissions[0] ?? "organization:read";
  const [permissionResource, setPermissionResource] = useState(
    initialPermission.split(":")[0] ?? "organization"
  );
  const [permissionAction, setPermissionAction] = useState(
    initialPermission.split(":")[1] ?? "read"
  );
  const [permissionResult, setPermissionResult] = useState<{
    allowed: boolean;
    label: string;
  } | null>(null);

  useEffect(() => {
    const nextPermission = props.availablePermissions[0];
    if (!nextPermission) {
      return;
    }
    const [resource = "organization", action = "read"] = nextPermission.split(":");
    setPermissionResource(resource);
    setPermissionAction(action);
    setPermissionResult(null);
  }, [props.availablePermissions, props.organizationId]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const allowed = await props.organizationClient.hasPermission({
      organizationId: props.organizationId,
      permission: {
        resource: permissionResource,
        action: permissionAction,
      },
    });
    setPermissionResult({
      allowed,
      label: allowed ? "Allowed" : "Denied",
    });
  };

  return (
    <div className="card">
      <h2>Permission probe</h2>
      <form onSubmit={(event) => void handleSubmit(event)}>
        <div className="field">
          <label htmlFor="permission-resource">Resource</label>
          <input
            id="permission-resource"
            value={permissionResource}
            onChange={(event) => setPermissionResource(event.target.value)}
            placeholder={props.availablePermissions[0]?.split(":")[0] ?? "organization"}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="permission-action">Action</label>
          <input
            id="permission-action"
            value={permissionAction}
            onChange={(event) => setPermissionAction(event.target.value)}
            placeholder={props.availablePermissions[0]?.split(":")[1] ?? "read"}
            required
          />
        </div>
        {props.availablePermissions.length > 0 ? (
          <p className="muted">
            Available permissions: <code>{props.availablePermissions.join(", ")}</code>
          </p>
        ) : null}
        <div className="actions">
          <button className="btn-primary" type="submit">
            Check permission
          </button>
        </div>
      </form>

      {permissionResult ? (
        <p className={permissionResult.allowed ? "text-success" : "text-error"}>
          {permissionResult.label}
        </p>
      ) : null}
    </div>
  );
}
