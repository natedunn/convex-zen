import { DomainsCard } from "./DomainsCard";
import { DynamicRolesCard } from "./DynamicRolesCard";
import { InvitationsCard } from "./InvitationsCard";
import { MembersCard } from "./MembersCard";
import { OrganizationSetupCard } from "./OrganizationSetupCard";
import { OrganizationSummaryCard } from "./OrganizationSummaryCard";
import { PermissionProbeCard } from "./PermissionProbeCard";
import type { OrganizationPlaygroundClient } from "./organizationPlaygroundShared";
import { useOrganizationPlayground } from "./useOrganizationPlayground";

interface OrganizationPlaygroundProps {
  organizationClient: OrganizationPlaygroundClient;
}

export function OrganizationPlayground({
  organizationClient,
}: OrganizationPlaygroundProps) {
  const state = useOrganizationPlayground(organizationClient);

  return (
    <>
      {state.error ? <p className="text-error">{state.error}</p> : null}
      {state.success ? <p className="text-success">{state.success}</p> : null}

      <OrganizationSetupCard
        loading={state.loading}
        organizations={state.organizations}
        selectedOrganizationId={state.selectedOrganizationId}
        onSelectOrganization={state.setSelectedOrganizationId}
        onCreateOrganization={state.createOrganization}
        onRefresh={state.loadOrganizations}
      />

      {state.selectedOrganization ? (
        <>
          <OrganizationSummaryCard
            organization={state.selectedOrganization}
            membership={state.membership}
            orgLoading={state.orgLoading}
            onRefresh={state.refreshSelectedOrganization}
          />

          <DynamicRolesCard
            capabilities={state.capabilities}
            roles={state.roles}
            availablePermissions={state.availablePermissions}
            onCreateRole={state.createRole}
            onUpdateRole={state.updateRole}
            onDeleteRole={state.deleteRole}
          />

          <InvitationsCard
            capabilities={state.capabilities}
            roles={state.roles}
            invitations={state.invitations}
            onInviteMember={state.inviteMember}
            onAcceptInvitationByToken={state.acceptInvitationByToken}
          />

          <MembersCard
            members={state.members}
            canManageMembers={state.canManageMembers}
            capabilities={state.capabilities}
            availableRoleOptions={state.availableRoleOptions}
            onSetMemberRole={state.setMemberRole}
            onTransferOwnership={state.transferOwnership}
            onRemoveMember={state.removeMember}
          />

          <DomainsCard
            capabilities={state.capabilities}
            domains={state.domains}
            onAddDomain={state.addDomain}
            onMarkDomainVerified={state.markDomainVerified}
          />

          <PermissionProbeCard
            organizationClient={organizationClient}
            organizationId={state.selectedOrganization._id}
            availablePermissions={state.availablePermissions}
          />
        </>
      ) : null}
    </>
  );
}

export type { OrganizationPlaygroundClient } from "./organizationPlaygroundShared";
