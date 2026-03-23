"use client";

import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../../convex/_generated/api";
import type {
  OrganizationListEntry,
  OrganizationMembership,
} from "./organization-playground-shared";
import { messageFromError } from "./organization-playground-shared";

export function OrganizationSummarySection({
  organization,
}: {
  organization: OrganizationListEntry["organization"];
}) {
  const membershipQuery = useQuery(
    convexQuery(api.zen.plugin.organization.getMembership, {
      organizationId: organization._id,
    })
  );

  return (
    <div className="card">
      <h2>Organization summary</h2>
      {membershipQuery.error ? (
        <p className="text-error">
          {messageFromError(membershipQuery.error, "Could not load membership")}
        </p>
      ) : null}
      <p className="session-detail">
        <strong>Name:</strong> {organization.name}
      </p>
      <p className="session-detail">
        <strong>Slug:</strong> <code>{organization.slug}</code>
      </p>
      <p className="session-detail">
        <strong>Your role:</strong>{" "}
        {membershipQuery.isLoading
          ? "Loading..."
          : (membershipQuery.data as OrganizationMembership)?.roleName ?? "unknown"}
      </p>
      <div className="actions">
        <button
          className="btn-secondary"
          type="button"
          onClick={() => void membershipQuery.refetch()}
        >
          Refresh summary
        </button>
      </div>
    </div>
  );
}
