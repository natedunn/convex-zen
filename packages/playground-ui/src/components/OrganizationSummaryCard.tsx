import type {
  OrganizationMembership,
  OrganizationSummary,
} from "./organizationPlaygroundShared";

export function OrganizationSummaryCard(props: {
  organization: OrganizationSummary;
  membership: OrganizationMembership | null;
  orgLoading: boolean;
  onRefresh: () => Promise<void>;
}) {
  return (
    <div className="card">
      <h2>{props.organization.name}</h2>
      <p className="session-detail">
        <strong>Slug:</strong> <code>{props.organization.slug}</code>
      </p>
      <p className="session-detail">
        <strong>Your role:</strong> <code>{props.membership?.roleName ?? "unknown"}</code>
      </p>
      <div className="actions">
        <button
          className="btn-secondary"
          type="button"
          onClick={() => void props.onRefresh()}
          disabled={props.orgLoading}
        >
          {props.orgLoading ? "Refreshing..." : "Refresh organization"}
        </button>
      </div>
    </div>
  );
}
