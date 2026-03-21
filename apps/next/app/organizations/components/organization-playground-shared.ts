"use client";

import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";

export type OrganizationListEntry =
  FunctionReturnType<typeof api.zen.plugin.organization.listOrganizations>["organizations"][number];
export type OrganizationMembership =
  FunctionReturnType<typeof api.zen.plugin.organization.getMembership>;
export type OrganizationMember =
  FunctionReturnType<typeof api.zen.plugin.organization.listMembers>[number];
export type OrganizationInvitation =
  FunctionReturnType<typeof api.zen.plugin.organization.listInvitations>[number];
export type OrganizationRole =
  FunctionReturnType<typeof api.zen.plugin.organization.listRoles>["roles"][number];
export type OrganizationDomain =
  FunctionReturnType<typeof api.zen.plugin.organization.listDomains>[number];
export type OrganizationPermissionList =
  FunctionReturnType<typeof api.zen.plugin.organization.listAvailablePermissions>;
export type OrganizationRoleAssignmentInput =
  FunctionArgs<typeof api.zen.plugin.organization.inviteMember>["role"];

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
