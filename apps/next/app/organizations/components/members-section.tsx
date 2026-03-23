"use client";

import { useEffect, useMemo, useState } from "react";
import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "../../../convex/_generated/api";
import {
  buildRoleOptions,
  messageFromError,
  type OrganizationMember,
  type OrganizationRoleListResult,
  parseRoleValue,
} from "./organization-playground-shared";

export function MembersSection({
  organizationId,
}: {
  organizationId: string;
}) {
  const membersQuery = useQuery(
    convexQuery(api.zen.plugin.organization.listMembers, { organizationId })
  );
  const rolesQuery = useQuery(
    convexQuery(api.zen.plugin.organization.listRoles, { organizationId })
  );
  const canUpdateMembersQuery = useQuery(
    convexQuery(api.zen.plugin.organization.hasPermission, {
      organizationId,
      permission: { resource: "member", action: "update" },
    })
  );
  const canDeleteMembersQuery = useQuery(
    convexQuery(api.zen.plugin.organization.hasPermission, {
      organizationId,
      permission: { resource: "member", action: "delete" },
    })
  );
  const canTransferQuery = useQuery(
    convexQuery(api.zen.plugin.organization.hasPermission, {
      organizationId,
      permission: { resource: "organization", action: "transfer" },
    })
  );

  const members = (membersQuery.data as OrganizationMember[] | undefined) ?? [];
  const roleOptions = useMemo(
    () =>
      buildRoleOptions(
        ((rolesQuery.data as OrganizationRoleListResult | undefined)?.roles ?? [])
      ),
    [rolesQuery.data]
  );
  const [memberRoleDrafts, setMemberRoleDrafts] = useState<Record<string, string>>(
    {}
  );

  useEffect(() => {
    setMemberRoleDrafts(
      Object.fromEntries(
        members.map((member) => [
          member.user._id,
          member.customRoleId ? `custom:${member.customRoleId}` : member.roleName,
        ])
      )
    );
  }, [members]);

  const setMemberRoleMutation = useMutation({
    mutationFn: useConvexMutation(api.zen.plugin.organization.setMemberRole),
    onSuccess: () => {
      void membersQuery.refetch();
    },
  });
  const removeMemberMutation = useMutation({
    mutationFn: useConvexMutation(api.zen.plugin.organization.removeMember),
    onSuccess: () => {
      void membersQuery.refetch();
    },
  });
  const transferOwnershipMutation = useMutation({
    mutationFn: useConvexMutation(api.zen.plugin.organization.transferOwnership),
    onSuccess: () => {
      void membersQuery.refetch();
    },
  });

  const canManageMembers =
    (canUpdateMembersQuery.data ?? false) ||
    (canDeleteMembersQuery.data ?? false) ||
    (canTransferQuery.data ?? false);

  return (
    <div className="card">
      <h2>Members</h2>
      {membersQuery.error ? (
        <p className="text-error">
          {messageFromError(membersQuery.error, "Could not load members")}
        </p>
      ) : null}
      {setMemberRoleMutation.error ? (
        <p className="text-error">
          {messageFromError(
            setMemberRoleMutation.error,
            "Could not update member role"
          )}
        </p>
      ) : null}
      {removeMemberMutation.error ? (
        <p className="text-error">
          {messageFromError(removeMemberMutation.error, "Could not remove member")}
        </p>
      ) : null}
      {transferOwnershipMutation.error ? (
        <p className="text-error">
          {messageFromError(
            transferOwnershipMutation.error,
            "Could not transfer ownership"
          )}
        </p>
      ) : null}
      {membersQuery.isLoading ? <p className="loading-text">Loading members...</p> : null}

      {membersQuery.isError ? (
        <p className="muted">You do not have permission to view members.</p>
      ) : members.length === 0 ? (
        <p className="muted">No members yet.</p>
      ) : (
        members.map((member) => (
          <div key={member._id} className="card">
            <strong>{member.user.email}</strong>
            <p className="session-detail">Role: {member.roleName}</p>
            {canManageMembers ? (
              <>
                <div className="field">
                  <label htmlFor={`member-role-${member.user._id}`}>
                    Change role
                  </label>
                  <select
                    id={`member-role-${member.user._id}`}
                    value={
                      memberRoleDrafts[member.user._id] ??
                      (member.customRoleId
                        ? `custom:${member.customRoleId}`
                        : member.roleName)
                    }
                    onChange={(event) =>
                      setMemberRoleDrafts((current) => ({
                        ...current,
                        [member.user._id]: event.target.value,
                      }))
                    }
                  >
                    {roleOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="actions">
                  {canUpdateMembersQuery.data ? (
                    <button
                      className="btn-secondary"
                      type="button"
                      disabled={setMemberRoleMutation.isPending}
                      onClick={() =>
                        setMemberRoleMutation.mutate({
                          organizationId,
                          userId: member.user._id,
                          role: parseRoleValue(memberRoleDrafts[member.user._id]!),
                        })
                      }
                    >
                      Save role
                    </button>
                  ) : null}
                  {canTransferQuery.data ? (
                    <button
                      className="btn-secondary"
                      type="button"
                      disabled={transferOwnershipMutation.isPending}
                      onClick={() =>
                        transferOwnershipMutation.mutate({
                          organizationId,
                          newOwnerUserId: member.user._id,
                        })
                      }
                    >
                      Transfer ownership
                    </button>
                  ) : null}
                  {canDeleteMembersQuery.data ? (
                    <button
                      className="btn-danger"
                      type="button"
                      disabled={removeMemberMutation.isPending}
                      onClick={() =>
                        removeMemberMutation.mutate({
                          organizationId,
                          userId: member.user._id,
                        })
                      }
                    >
                      Remove member
                    </button>
                  ) : null}
                </div>
              </>
            ) : null}
          </div>
        ))
      )}
    </div>
  );
}
