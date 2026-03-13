import { useEffect, useMemo, useState } from "react";
import type {
  OrganizationCapabilities,
  OrganizationDomain,
  OrganizationInvitation,
  OrganizationMember,
  OrganizationMembership,
  OrganizationPlaygroundClient,
  OrganizationRole,
  OrganizationRoleAssignmentInput,
  OrganizationSummary,
} from "./organizationPlaygroundShared";
import { EMPTY_CAPABILITIES } from "./organizationPlaygroundShared";

export function useOrganizationPlayground(
  organizationClient: OrganizationPlaygroundClient
) {
  const [organizations, setOrganizations] = useState<
    Array<{
      organization: OrganizationSummary;
      membership: OrganizationMembership;
    }>
  >([]);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState("");
  const [membership, setMembership] = useState<OrganizationMembership | null>(null);
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [roles, setRoles] = useState<OrganizationRole[]>([]);
  const [invitations, setInvitations] = useState<OrganizationInvitation[]>([]);
  const [domains, setDomains] = useState<OrganizationDomain[]>([]);
  const [availablePermissions, setAvailablePermissions] = useState<string[]>([]);
  const [capabilities, setCapabilities] = useState<OrganizationCapabilities>(
    EMPTY_CAPABILITIES
  );
  const [loading, setLoading] = useState(true);
  const [orgLoading, setOrgLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const selectedOrganization = useMemo(
    () =>
      organizations.find((entry) => entry.organization._id === selectedOrganizationId)
        ?.organization ?? null,
    [organizations, selectedOrganizationId]
  );

  const canManageMembers = useMemo(
    () =>
      capabilities.canUpdateMembers ||
      capabilities.canDeleteMembers ||
      capabilities.canTransferOwnership,
    [capabilities]
  );

  const availableRoleOptions = useMemo(
    () => [
      { value: "admin", label: "System: admin" },
      { value: "member", label: "System: member" },
      ...roles.map((role) => ({
        value: `custom:${role._id}`,
        label: `Custom: ${role.slug}`,
      })),
    ],
    [roles]
  );

  const clearFeedback = () => {
    setError(null);
    setSuccess(null);
  };

  const loadOrganizations = async () => {
    setLoading(true);
    clearFeedback();
    try {
      const result = await organizationClient.listOrganizations();
      setOrganizations(result.organizations);
      setSelectedOrganizationId((current) => {
        if (
          current &&
          result.organizations.some((entry) => entry.organization._id === current)
        ) {
          return current;
        }
        return result.organizations[0]?.organization._id ?? "";
      });
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load organizations"
      );
    } finally {
      setLoading(false);
    }
  };

  const loadOrganizationDetails = async (organizationId: string) => {
    if (!organizationId) {
      setMembership(null);
      setMembers([]);
      setRoles([]);
      setInvitations([]);
      setDomains([]);
      setAvailablePermissions([]);
      setCapabilities(EMPTY_CAPABILITIES);
      return;
    }

    setOrgLoading(true);
    try {
      const [
        nextMembership,
        nextMembers,
        canReadAccessControl,
        canReadRoles,
        canCreateRoles,
        canUpdateRoles,
        canDeleteRoles,
        canReadInvitations,
        canCreateInvitations,
        canReadDomains,
        canCreateDomains,
        canVerifyDomains,
        canUpdateMembers,
        canDeleteMembers,
        canTransferOwnership,
      ] = await Promise.all([
        organizationClient.getMembership({ organizationId }),
        organizationClient.listMembers({ organizationId }),
        organizationClient.hasPermission({
          organizationId,
          permission: { resource: "accessControl", action: "read" },
        }),
        organizationClient.hasPermission({
          organizationId,
          permission: { resource: "role", action: "read" },
        }),
        organizationClient.hasPermission({
          organizationId,
          permission: { resource: "role", action: "create" },
        }),
        organizationClient.hasPermission({
          organizationId,
          permission: { resource: "role", action: "update" },
        }),
        organizationClient.hasPermission({
          organizationId,
          permission: { resource: "role", action: "delete" },
        }),
        organizationClient.hasPermission({
          organizationId,
          permission: { resource: "invitation", action: "read" },
        }),
        organizationClient.hasPermission({
          organizationId,
          permission: { resource: "invitation", action: "create" },
        }),
        organizationClient.hasPermission({
          organizationId,
          permission: { resource: "domain", action: "read" },
        }),
        organizationClient.hasPermission({
          organizationId,
          permission: { resource: "domain", action: "create" },
        }),
        organizationClient.hasPermission({
          organizationId,
          permission: { resource: "domain", action: "verify" },
        }),
        organizationClient.hasPermission({
          organizationId,
          permission: { resource: "member", action: "update" },
        }),
        organizationClient.hasPermission({
          organizationId,
          permission: { resource: "member", action: "delete" },
        }),
        organizationClient.hasPermission({
          organizationId,
          permission: { resource: "organization", action: "transfer" },
        }),
      ]);

      const [nextRoles, nextInvitations, nextDomains, nextAvailablePermissions] =
        await Promise.all([
        canReadRoles
          ? organizationClient.listRoles({ organizationId })
          : Promise.resolve({ roles: [] }),
        canReadInvitations
          ? organizationClient.listInvitations({ organizationId })
          : Promise.resolve([] as OrganizationInvitation[]),
        canReadDomains
          ? organizationClient.listDomains({ organizationId })
          : Promise.resolve([] as OrganizationDomain[]),
        canReadAccessControl
          ? organizationClient.listAvailablePermissions({ organizationId })
          : Promise.resolve({ resources: {}, permissions: [] }),
      ]);

      setMembership(nextMembership);
      setMembers(nextMembers);
      setRoles(nextRoles.roles);
      setInvitations(nextInvitations);
      setDomains(nextDomains);
      setAvailablePermissions(nextAvailablePermissions.permissions);
      setCapabilities({
        canReadAccessControl,
        canReadRoles,
        canCreateRoles,
        canUpdateRoles,
        canDeleteRoles,
        canReadInvitations,
        canCreateInvitations,
        canReadDomains,
        canCreateDomains,
        canVerifyDomains,
        canUpdateMembers,
        canDeleteMembers,
        canTransferOwnership,
      });
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load organization details"
      );
    } finally {
      setOrgLoading(false);
    }
  };

  useEffect(() => {
    void loadOrganizations();
  }, []);

  useEffect(() => {
    if (!selectedOrganizationId) {
      return;
    }
    void loadOrganizationDetails(selectedOrganizationId);
  }, [selectedOrganizationId]);

  const refreshSelectedOrganization = async () => {
    if (!selectedOrganizationId) {
      await loadOrganizations();
      return;
    }
    await loadOrganizations();
    await loadOrganizationDetails(selectedOrganizationId);
  };

  const createOrganization = async (args: { name: string; slug: string }) => {
    clearFeedback();
    try {
      await organizationClient.createOrganization(args);
      setSuccess("Organization created");
      await loadOrganizations();
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Could not create organization"
      );
      throw createError;
    }
  };

  const createRole = async (args: {
    name: string;
    slug: string;
    permissions: string[];
  }) => {
    if (!selectedOrganizationId) {
      const error = new Error("Select an organization first");
      setError(error.message);
      throw error;
    }
    clearFeedback();
    try {
      await organizationClient.createRole({
        organizationId: selectedOrganizationId,
        ...args,
      });
      setSuccess("Role created");
      await loadOrganizationDetails(selectedOrganizationId);
    } catch (createError) {
      setError(
        createError instanceof Error ? createError.message : "Could not create role"
      );
      throw createError;
    }
  };

  const inviteMember = async (args: {
    email: string;
    role: OrganizationRoleAssignmentInput;
  }) => {
    if (!selectedOrganizationId) {
      const error = new Error("Select an organization first");
      setError(error.message);
      throw error;
    }
    clearFeedback();
    try {
      const result = await organizationClient.inviteMember({
        organizationId: selectedOrganizationId,
        ...args,
      });
      setSuccess("Invitation created");
      await loadOrganizationDetails(selectedOrganizationId);
      return result.token;
    } catch (inviteError) {
      setError(
        inviteError instanceof Error
          ? inviteError.message
          : "Could not invite member"
      );
      throw inviteError;
    }
  };

  const acceptInvitationByToken = async (token: string) => {
    clearFeedback();
    try {
      await organizationClient.acceptInvitation({ token });
      setSuccess("Invitation accepted");
      await loadOrganizations();
      if (selectedOrganizationId) {
        await loadOrganizationDetails(selectedOrganizationId);
      }
    } catch (acceptError) {
      setError(
        acceptError instanceof Error
          ? acceptError.message
          : "Could not accept invitation"
      );
      throw acceptError;
    }
  };

  const setMemberRole = async (
    userId: string,
    role: OrganizationRoleAssignmentInput
  ) => {
    if (!selectedOrganizationId) {
      const error = new Error("Select an organization first");
      setError(error.message);
      throw error;
    }
    clearFeedback();
    try {
      await organizationClient.setMemberRole({
        organizationId: selectedOrganizationId,
        userId,
        role,
      });
      setSuccess("Member role updated");
      await loadOrganizationDetails(selectedOrganizationId);
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Could not update member role"
      );
      throw updateError;
    }
  };

  const removeMember = async (userId: string) => {
    if (!selectedOrganizationId) {
      const error = new Error("Select an organization first");
      setError(error.message);
      throw error;
    }
    clearFeedback();
    try {
      await organizationClient.removeMember({
        organizationId: selectedOrganizationId,
        userId,
      });
      setSuccess("Member removed");
      await loadOrganizationDetails(selectedOrganizationId);
    } catch (removeError) {
      setError(
        removeError instanceof Error
          ? removeError.message
          : "Could not remove member"
      );
      throw removeError;
    }
  };

  const transferOwnership = async (newOwnerUserId: string) => {
    if (!selectedOrganizationId) {
      const error = new Error("Select an organization first");
      setError(error.message);
      throw error;
    }
    clearFeedback();
    try {
      await organizationClient.transferOwnership({
        organizationId: selectedOrganizationId,
        newOwnerUserId,
      });
      setSuccess("Ownership transferred");
      await loadOrganizationDetails(selectedOrganizationId);
    } catch (transferError) {
      setError(
        transferError instanceof Error
          ? transferError.message
          : "Could not transfer ownership"
      );
      throw transferError;
    }
  };

  const addDomain = async (hostname: string) => {
    if (!selectedOrganizationId) {
      const error = new Error("Select an organization first");
      setError(error.message);
      throw error;
    }
    clearFeedback();
    try {
      await organizationClient.addDomain({
        organizationId: selectedOrganizationId,
        hostname,
      });
      setSuccess("Domain added");
      await loadOrganizationDetails(selectedOrganizationId);
    } catch (addError) {
      setError(
        addError instanceof Error ? addError.message : "Could not add domain"
      );
      throw addError;
    }
  };

  const markDomainVerified = async (domainId: string) => {
    clearFeedback();
    try {
      await organizationClient.markDomainVerified({ domainId });
      setSuccess("Domain marked verified");
      await loadOrganizationDetails(selectedOrganizationId);
    } catch (verifyError) {
      setError(
        verifyError instanceof Error
          ? verifyError.message
          : "Could not verify domain"
      );
      throw verifyError;
    }
  };

  const updateRole = async (args: {
    roleId: string;
    name?: string;
    slug?: string;
    description?: string;
    permissions?: string[];
  }) => {
    clearFeedback();
    try {
      await organizationClient.updateRole(args);
      setSuccess("Role updated");
      if (selectedOrganizationId) {
        await loadOrganizationDetails(selectedOrganizationId);
      }
    } catch (updateError) {
      setError(
        updateError instanceof Error ? updateError.message : "Could not update role"
      );
      throw updateError;
    }
  };

  const deleteRole = async (roleId: string) => {
    clearFeedback();
    try {
      await organizationClient.deleteRole({ roleId });
      setSuccess("Role deleted");
      if (selectedOrganizationId) {
        await loadOrganizationDetails(selectedOrganizationId);
      }
    } catch (deleteError) {
      setError(
        deleteError instanceof Error ? deleteError.message : "Could not delete role"
      );
      throw deleteError;
    }
  };

  return {
    organizations,
    selectedOrganizationId,
    setSelectedOrganizationId,
    selectedOrganization,
    membership,
    members,
    roles,
    invitations,
    domains,
    availablePermissions,
    capabilities,
    canManageMembers,
    availableRoleOptions,
    loading,
    orgLoading,
    error,
    success,
    loadOrganizations,
    refreshSelectedOrganization,
    createOrganization,
    createRole,
    updateRole,
    deleteRole,
    inviteMember,
    acceptInvitationByToken,
    setMemberRole,
    removeMember,
    transferOwnership,
    addDomain,
    markDomainVerified,
  };
}
