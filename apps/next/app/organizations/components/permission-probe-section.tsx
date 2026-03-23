"use client";

import { useEffect, useState } from "react";
import { convexQuery, useConvex } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import type { FunctionArgs } from "convex/server";
import { api } from "../../../convex/_generated/api";
import {
  EMPTY_PERMISSION_LIST,
  messageFromError,
  type OrganizationPermissionList,
} from "./organization-playground-shared";

export function PermissionProbeSection({
  organizationId,
}: {
  organizationId: string;
}) {
  const convex = useConvex();
  const permissionListQuery = useQuery(
    convexQuery(api.zen.plugin.organization.listAvailablePermissions, {
      organizationId,
    })
  );
  const [permissionResource, setPermissionResource] = useState("organization");
  const [permissionAction, setPermissionAction] = useState("read");
  const [permissionResult, setPermissionResult] = useState<{
    allowed: boolean;
    label: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const permissionList =
    (permissionListQuery.data as OrganizationPermissionList | undefined) ??
    EMPTY_PERMISSION_LIST;

  useEffect(() => {
    const nextPermission = permissionList.permissions[0] ?? "organization:read";
    const [resource = "organization", action = "read"] = nextPermission.split(":");
    setPermissionResource(resource);
    setPermissionAction(action);
    setPermissionResult(null);
  }, [organizationId, permissionList]);

  const handlePermissionProbe = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      const allowed = await convex.query(
        api.zen.plugin.organization.hasPermission,
        {
          organizationId,
          permission: {
            resource: permissionResource,
            action: permissionAction,
          },
        } as FunctionArgs<typeof api.zen.plugin.organization.hasPermission>
      );
      setPermissionResult({
        allowed: allowed as boolean,
        label: allowed ? "Allowed" : "Denied",
      });
    } catch (probeError) {
      setPermissionResult(null);
      setError(messageFromError(probeError, "Could not evaluate permission"));
    }
  };

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
      {error ? <p className="text-error">{error}</p> : null}
      {permissionListQuery.isLoading ? (
        <p className="loading-text">Loading permissions...</p>
      ) : null}
      {permissionList.permissions.length > 0 ? (
        <p className="muted">
          Available permissions:{" "}
          <code>
            {permissionList.permissions.join(", ")}
          </code>
        </p>
      ) : null}
      <form onSubmit={handlePermissionProbe}>
        <div className="field">
          <label htmlFor="permission-resource">Resource</label>
          <input
            id="permission-resource"
            value={permissionResource}
            onChange={(event) => setPermissionResource(event.target.value)}
            placeholder={permissionList.permissions[0]?.split(":")[0] ?? "organization"}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="permission-action">Action</label>
          <input
            id="permission-action"
            value={permissionAction}
            onChange={(event) => setPermissionAction(event.target.value)}
            placeholder={permissionList.permissions[0]?.split(":")[1] ?? "read"}
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
