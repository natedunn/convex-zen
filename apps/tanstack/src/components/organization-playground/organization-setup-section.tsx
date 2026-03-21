import { useState } from "react";
import { useConvexMutation } from "@convex-dev/react-query";
import { useMutation } from "@tanstack/react-query";
import { api } from "../../../convex/_generated/api";
import type { OrganizationListEntry } from "./shared";
import { messageFromError } from "./shared";

export function OrganizationSetupSection({
  loading,
  organizations,
  onOrganizationsChanged,
  selectedOrganizationId,
  onSelectOrganization,
}: {
  loading: boolean;
  organizations: OrganizationListEntry[];
  onOrganizationsChanged: () => void;
  selectedOrganizationId: string;
  onSelectOrganization: (organizationId: string) => void;
}) {
  const [organizationName, setOrganizationName] = useState("");
  const [organizationSlug, setOrganizationSlug] = useState("");
  const createOrganizationMutation = useMutation({
    mutationFn: useConvexMutation(api.zen.plugin.organization.createOrganization),
    onSuccess: () => {
      setOrganizationName("");
      setOrganizationSlug("");
      onOrganizationsChanged();
    },
  });

  return (
    <div className="card">
      <h2>Organization setup</h2>
      {createOrganizationMutation.error ? (
        <p className="text-error">
          {messageFromError(
            createOrganizationMutation.error,
            "Could not create organization"
          )}
        </p>
      ) : null}
      {createOrganizationMutation.isSuccess ? (
        <p className="text-success">Organization created</p>
      ) : null}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          createOrganizationMutation.mutate({
            name: organizationName,
            slug: organizationSlug,
          });
        }}
      >
        <div className="field">
          <label htmlFor="organization-name">Organization name</label>
          <input
            id="organization-name"
            value={organizationName}
            onChange={(event) => setOrganizationName(event.target.value)}
            placeholder="Acme Inc"
            required
          />
        </div>
        <div className="field">
          <label htmlFor="organization-slug">Organization slug</label>
          <input
            id="organization-slug"
            value={organizationSlug}
            onChange={(event) => setOrganizationSlug(event.target.value)}
            placeholder="acme-inc"
            required
          />
        </div>
        <div className="actions">
          <button
            className="btn-primary"
            type="submit"
            disabled={createOrganizationMutation.isPending}
          >
            {createOrganizationMutation.isPending
              ? "Creating..."
              : "Create organization"}
          </button>
          <button
            className="btn-secondary"
            type="button"
            onClick={onOrganizationsChanged}
          >
            Refresh organizations
          </button>
        </div>
      </form>

      <hr className="card-divider" />

      {loading ? (
        <p className="loading-text">Loading organizations...</p>
      ) : organizations.length === 0 ? (
        <p className="muted">No organizations yet.</p>
      ) : (
        <div className="field">
          <label htmlFor="organization-select">Current organization</label>
          <select
            id="organization-select"
            value={selectedOrganizationId}
            onChange={(event) => onSelectOrganization(event.target.value)}
          >
            {organizations.map((entry) => (
              <option key={entry.organization._id} value={entry.organization._id}>
                {entry.organization.name} ({entry.membership.roleName})
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
