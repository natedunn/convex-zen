import { useEffect, useState } from "react";
import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../../convex/_generated/api";
import { useConvex } from "@convex-dev/react-query";
import { messageFromError } from "./shared";

export function PermissionProbeSection({
  organizationId,
}: {
  organizationId: string;
}) {
  const convex = useConvex();
  const permissionListQuery = useQuery({
    ...convexQuery(api.zen.plugin.organization.listAvailablePermissions, {
      organizationId,
    }),
  });
  const [permissionResource, setPermissionResource] = useState("organization");
  const [permissionAction, setPermissionAction] = useState("read");
  const [permissionResult, setPermissionResult] = useState<{
    allowed: boolean;
    label: string;
  } | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  useEffect(() => {
    const nextPermission =
      permissionListQuery.data?.permissions[0] ?? "organization:read";
    const [resource = "organization", action = "read"] = nextPermission.split(":");
    setPermissionResource(resource);
    setPermissionAction(action);
    setPermissionResult(null);
  }, [permissionListQuery.data, organizationId]);

  return (
    <div className="card">
      <h2>Permission probe</h2>
      {permissionListQuery.error ? (
        <p className="text-error">
          {messageFromError(
            permissionListQuery.error,
            "Could not load available permissions"
          )}
        </p>
      ) : null}
      {permissionError ? <p className="text-error">{permissionError}</p> : null}
      {permissionListQuery.data?.permissions.length ? (
        <p className="muted">
          Available permissions:{" "}
          <code>{permissionListQuery.data.permissions.join(", ")}</code>
        </p>
      ) : null}
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          setPermissionError(null);
          try {
            const allowed = await convex.query(
              api.zen.plugin.organization.hasPermission,
              {
                organizationId,
                permission: {
                  resource: permissionResource,
                  action: permissionAction,
                },
              }
            );
            setPermissionResult({
              allowed,
              label: allowed ? "Allowed" : "Denied",
            });
          } catch (probeError) {
            setPermissionResult(null);
            setPermissionError(
              messageFromError(probeError, "Could not evaluate permission")
            );
          }
        }}
      >
        <div className="field">
          <label htmlFor="permission-resource">Resource</label>
          <input
            id="permission-resource"
            value={permissionResource}
            onChange={(event) => setPermissionResource(event.target.value)}
            placeholder={
              permissionListQuery.data?.permissions[0]?.split(":")[0] ??
              "organization"
            }
            required
          />
        </div>
        <div className="field">
          <label htmlFor="permission-action">Action</label>
          <input
            id="permission-action"
            value={permissionAction}
            onChange={(event) => setPermissionAction(event.target.value)}
            placeholder={
              permissionListQuery.data?.permissions[0]?.split(":")[1] ?? "read"
            }
            required
          />
        </div>
        <div className="actions">
          <button className="btn-primary" type="submit">
            Check permission
          </button>
          <button
            className="btn-secondary"
            type="button"
            onClick={() => void permissionListQuery.refetch()}
          >
            Refresh permissions
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
