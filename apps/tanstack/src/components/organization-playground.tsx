import { useEffect, useState } from "react";
import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../convex/_generated/api";
import { DomainsSection } from "./organization-playground/domains-section";
import { DynamicRolesSection } from "./organization-playground/dynamic-roles-section";
import { InvitationsSection } from "./organization-playground/invitations-section";
import { MembersSection } from "./organization-playground/members-section";
import { OrganizationSetupSection } from "./organization-playground/organization-setup-section";
import { OrganizationSummarySection } from "./organization-playground/organization-summary-section";
import { PermissionProbeSection } from "./organization-playground/permission-probe-section";
import {
	type OrganizationListEntry,
	messageFromError,
} from "./organization-playground/shared";

export function OrganizationPlayground() {
	const organizationsQuery = useQuery(
		convexQuery(api.zen.plugin.organization.listOrganizations, {}),
	);
	const organizations: OrganizationListEntry[] =
		organizationsQuery.data?.organizations ?? [];
	const [selectedOrganizationId, setSelectedOrganizationId] = useState("");

	useEffect(() => {
		if (
			selectedOrganizationId &&
			organizations.some(
				(entry) => entry.organization._id === selectedOrganizationId,
			)
		) {
			return;
		}
		setSelectedOrganizationId(organizations[0]?.organization._id ?? "");
	}, [organizations, selectedOrganizationId]);

	const selectedOrganization =
		organizations.find(
			(entry) => entry.organization._id === selectedOrganizationId,
		)?.organization ?? null;

	return (
		<>
			{organizationsQuery.error ? (
				<p className="text-error">
					{messageFromError(
						organizationsQuery.error,
						"Could not load organizations",
					)}
				</p>
			) : null}

			<OrganizationSetupSection
				loading={organizationsQuery.isLoading}
				organizations={organizations}
				onOrganizationsChanged={() => void organizationsQuery.refetch()}
				selectedOrganizationId={selectedOrganizationId}
				onSelectOrganization={setSelectedOrganizationId}
			/>

			{selectedOrganization ? (
				<>
					<OrganizationSummarySection organization={selectedOrganization} />
					<DynamicRolesSection organizationId={selectedOrganizationId} />
					<InvitationsSection
						organizationId={selectedOrganizationId}
						onMembershipChanged={() => void organizationsQuery.refetch()}
					/>
					<MembersSection organizationId={selectedOrganizationId} />
					<DomainsSection organizationId={selectedOrganizationId} />
					<PermissionProbeSection organizationId={selectedOrganizationId} />
				</>
			) : null}
		</>
	);
}
