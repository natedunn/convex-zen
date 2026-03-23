"use client";

export type OrganizationRoleAssignmentInput =
  | {
      type: "system";
      systemRole: "admin" | "member";
    }
  | {
      type: "custom";
      customRoleId: string;
    };

export type OrganizationListEntry = {
  organization: {
    _id: string;
    name: string;
    slug: string;
  };
  membership: {
    roleName: string;
  };
};

export type OrganizationListResult = {
  organizations: OrganizationListEntry[];
};

export type OrganizationMembership = {
  roleName: string;
  roleType?: string;
} | null;

export type OrganizationMember = {
  _id: string;
  user: {
    _id: string;
    email: string;
  };
  roleName: string;
  customRoleId?: string;
};

export type OrganizationInvitation = {
  _id: string;
  email: string;
  roleName: string;
  expiresAt?: number;
  acceptedAt?: number;
  cancelledAt?: number;
  declinedAt?: number;
};

export type OrganizationInviteResult = {
  token: string;
};

export type OrganizationRole = {
  _id: string;
  name: string;
  slug: string;
  permissions: string[];
};

export type OrganizationRoleListResult = {
  roles: OrganizationRole[];
};

export type OrganizationDomain = {
  _id: string;
  hostname: string;
  verifiedAt?: number;
};

export type OrganizationPermissionList = {
  permissions: string[];
  resources: Record<string, string[]>;
};

export type RoleOption = {
  value: string;
  label: string;
};

export const SYSTEM_ROLE_OPTIONS = ["admin", "member"] as const;
export const EMPTY_PERMISSION_LIST: OrganizationPermissionList = {
  permissions: [],
  resources: {},
};

export function messageFromError(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function formatTimestamp(timestamp?: number): string {
  if (!timestamp) {
    return "pending";
  }
  return new Date(timestamp).toLocaleString();
}

export function systemRole(
  role: (typeof SYSTEM_ROLE_OPTIONS)[number]
): OrganizationRoleAssignmentInput {
  return {
    type: "system",
    systemRole: role,
  };
}

export function buildRoleOptions(roles: OrganizationRole[]): RoleOption[] {
  return [
    { value: "admin", label: "System: admin" },
    { value: "member", label: "System: member" },
    ...roles.map((role) => ({
      value: `custom:${role._id}`,
      label: `Custom: ${role.slug}`,
    })),
  ];
}

export function parseRoleValue(
  value: string
): OrganizationRoleAssignmentInput {
  if (value.startsWith("custom:")) {
    return {
      type: "custom",
      customRoleId: value.slice("custom:".length),
    };
  }
  return systemRole(value as (typeof SYSTEM_ROLE_OPTIONS)[number]);
}
