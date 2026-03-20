"use client";

import { useEffect, useState } from "react";
import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../convex/_generated/api";
import { DomainsSection } from "./components/domains-section";
import { DynamicRolesSection } from "./components/dynamic-roles-section";
import { InvitationsSection } from "./components/invitations-section";
import { MembersSection } from "./components/members-section";
import { OrganizationSetupSection } from "./components/organization-setup-section";
import { OrganizationSummarySection } from "./components/organization-summary-section";
import { PermissionProbeSection } from "./components/permission-probe-section";
import type { OrganizationListEntry } from "./components/organization-playground-shared";
import { messageFromError } from "./components/organization-playground-shared";

export function OrganizationPlayground() {
  const organizationsQuery = useQuery(
    convexQuery(api.auth.plugin.organization.listOrganizations, {})
  );
  const organizations = organizationsQuery.data?.organizations ?? [];
  const [selectedOrganizationId, setSelectedOrganizationId] = useState("");
  const selectedOrganization =
    organizations.find(
      (entry) => entry.organization._id === selectedOrganizationId
    )?.organization ?? null;

  useEffect(() => {
    if (
      selectedOrganizationId &&
      organizations.some((entry) => entry.organization._id === selectedOrganizationId)
    ) {
      return;
    }
    setSelectedOrganizationId(organizations[0]?.organization._id ?? "");
  }, [organizations, selectedOrganizationId]);

  return (
    <>
      {organizationsQuery.error ? (
        <p className="text-error">
          {messageFromError(
            organizationsQuery.error,
            "Could not load organizations"
          )}
        </p>
      ) : null}

      <OrganizationSetupSection
        loading={organizationsQuery.isLoading}
        organizations={organizations}
        selectedOrganizationId={selectedOrganizationId}
        onOrganizationsChanged={() => organizationsQuery.refetch()}
        onSelectOrganization={setSelectedOrganizationId}
      />

      {selectedOrganization ? (
        <>
          <OrganizationSummarySection
            organization={selectedOrganization}
          />
          <DynamicRolesSection
            organizationId={selectedOrganizationId}
          />
          <InvitationsSection
            organizationId={selectedOrganizationId}
            onMembershipChanged={() => organizationsQuery.refetch()}
          />
          <MembersSection
            organizationId={selectedOrganizationId}
          />
          <DomainsSection
            organizationId={selectedOrganizationId}
          />
          <PermissionProbeSection
            organizationId={selectedOrganizationId}
          />
        </>
      ) : null}
    </>
  );
}
