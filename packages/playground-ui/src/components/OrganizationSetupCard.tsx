import { useState } from "react";
import type {
  OrganizationMembership,
  OrganizationSummary,
} from "./organizationPlaygroundShared";

export function OrganizationSetupCard(props: {
  loading: boolean;
  organizations: Array<{
    organization: OrganizationSummary;
    membership: OrganizationMembership;
  }>;
  selectedOrganizationId: string;
  onSelectOrganization: (organizationId: string) => void;
  onCreateOrganization: (args: { name: string; slug: string }) => Promise<void>;
  onRefresh: () => Promise<void>;
}) {
  const [orgName, setOrgName] = useState("");
  const [orgSlug, setOrgSlug] = useState("");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    await props.onCreateOrganization({
      name: orgName,
      slug: orgSlug,
    });
    setOrgName("");
    setOrgSlug("");
  };

  return (
    <div className="card">
      <h2>Organizations</h2>
      <p className="muted">
        Create organizations, dynamic roles, invites, domains, and permission
        checks against the real plugin routes.
      </p>

      <form onSubmit={(event) => void handleSubmit(event)}>
        <div className="field">
          <label htmlFor="org-name">Organization name</label>
          <input
            id="org-name"
            value={orgName}
            onChange={(event) => setOrgName(event.target.value)}
            placeholder="Acme Inc"
            required
          />
        </div>
        <div className="field">
          <label htmlFor="org-slug">Slug</label>
          <input
            id="org-slug"
            value={orgSlug}
            onChange={(event) => setOrgSlug(event.target.value)}
            placeholder="acme-inc"
            required
          />
        </div>
        <div className="actions">
          <button className="btn-primary" type="submit">
            Create organization
          </button>
          <button
            className="btn-secondary"
            type="button"
            onClick={() => void props.onRefresh()}
          >
            Refresh list
          </button>
        </div>
      </form>

      {props.loading ? (
        <p className="loading-text">Loading organizations...</p>
      ) : props.organizations.length === 0 ? (
        <p className="muted">No organizations yet.</p>
      ) : (
        <div className="field">
          <label htmlFor="org-select">Current organization</label>
          <select
            id="org-select"
            value={props.selectedOrganizationId}
            onChange={(event) => props.onSelectOrganization(event.target.value)}
          >
            {props.organizations.map((entry) => (
              <option key={entry.organization._id} value={entry.organization._id}>
                {entry.organization.name} ({entry.organization.slug}) as{" "}
                {entry.membership.roleName}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
