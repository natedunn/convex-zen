export type OrganizationSummary = {
  _id: string;
  name: string;
  slug: string;
};

export type OrganizationMembership = {
  _id: string;
  userId: string;
  roleType: "system" | "custom";
  roleName: string;
  systemRole?: "owner" | "admin" | "member";
  customRoleId?: string;
};

export type OrganizationMember = OrganizationMembership & {
  user: {
    _id: string;
    email: string;
    name?: string;
  };
};

export type OrganizationInvitation = {
  _id: string;
  email: string;
  roleName: string;
  acceptedAt?: number;
  cancelledAt?: number;
  declinedAt?: number;
  expiresAt: number;
};

export type OrganizationRole = {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  permissions: string[];
};

export type OrganizationDomain = {
  _id: string;
  hostname: string;
  verifiedAt?: number;
};

export type OrganizationRoleAssignmentInput =
  | {
      type: "system";
      systemRole: "owner" | "admin" | "member";
      customRoleId?: undefined;
    }
  | {
      type: "custom";
      customRoleId: string;
      systemRole?: undefined;
    };

export interface OrganizationPlaygroundClient {
  listOrganizations: () => Promise<{
    organizations: Array<{
      organization: OrganizationSummary;
      membership: OrganizationMembership;
    }>;
  }>;
  createOrganization: (args: {
    name: string;
    slug: string;
    logo?: string;
  }) => Promise<unknown>;
  getMembership: (args: {
    organizationId: string;
  }) => Promise<OrganizationMembership | null>;
  listMembers: (args: {
    organizationId: string;
  }) => Promise<OrganizationMember[]>;
  inviteMember: (args: {
    organizationId: string;
    email: string;
    role: OrganizationRoleAssignmentInput;
  }) => Promise<{ invitation: OrganizationInvitation; token: string }>;
  listInvitations: (args: {
    organizationId: string;
  }) => Promise<OrganizationInvitation[]>;
  acceptInvitation: (args: { token: string }) => Promise<OrganizationInvitation>;
  createRole: (args: {
    organizationId: string;
    name: string;
    slug: string;
    description?: string;
    permissions: string[];
  }) => Promise<OrganizationRole>;
  updateRole: (args: {
    roleId: string;
    name?: string;
    slug?: string;
    description?: string;
    permissions?: string[];
  }) => Promise<OrganizationRole>;
  deleteRole: (args: {
    roleId: string;
  }) => Promise<void>;
  listRoles: (args: {
    organizationId: string;
  }) => Promise<{ roles: OrganizationRole[] }>;
  listAvailablePermissions: (args: {
    organizationId: string;
  }) => Promise<{
    resources: Record<string, string[]>;
    permissions: string[];
  }>;
  setMemberRole: (args: {
    organizationId: string;
    userId: string;
    role: OrganizationRoleAssignmentInput;
  }) => Promise<unknown>;
  removeMember: (args: {
    organizationId: string;
    userId: string;
  }) => Promise<unknown>;
  transferOwnership: (args: {
    organizationId: string;
    newOwnerUserId: string;
  }) => Promise<unknown>;
  addDomain: (args: {
    organizationId: string;
    hostname: string;
  }) => Promise<unknown>;
  listDomains: (args: {
    organizationId: string;
  }) => Promise<OrganizationDomain[]>;
  markDomainVerified: (args: { domainId: string }) => Promise<unknown>;
  hasPermission: (args: {
    organizationId: string;
    permission: {
      resource: string;
      action: string;
    };
  }) => Promise<boolean>;
}

export type OrganizationCapabilities = {
  canReadAccessControl: boolean;
  canReadRoles: boolean;
  canCreateRoles: boolean;
  canUpdateRoles: boolean;
  canDeleteRoles: boolean;
  canReadInvitations: boolean;
  canCreateInvitations: boolean;
  canReadDomains: boolean;
  canCreateDomains: boolean;
  canVerifyDomains: boolean;
  canUpdateMembers: boolean;
  canDeleteMembers: boolean;
  canTransferOwnership: boolean;
};

export const EMPTY_CAPABILITIES: OrganizationCapabilities = {
  canReadAccessControl: false,
  canReadRoles: false,
  canCreateRoles: false,
  canUpdateRoles: false,
  canDeleteRoles: false,
  canReadInvitations: false,
  canCreateInvitations: false,
  canReadDomains: false,
  canCreateDomains: false,
  canVerifyDomains: false,
  canUpdateMembers: false,
  canDeleteMembers: false,
  canTransferOwnership: false,
};

export const SYSTEM_ROLE_OPTIONS = ["admin", "member"] as const;

export function formatTimestamp(timestamp?: number): string {
  if (!timestamp) {
    return "pending";
  }
  return new Date(timestamp).toLocaleString();
}
