import { useEffect, useState } from "react";
import type {
  OrganizationCapabilities,
  OrganizationMember,
  OrganizationRoleAssignmentInput,
} from "./organizationPlaygroundShared";

export function MembersCard(props: {
  members: OrganizationMember[];
  canManageMembers: boolean;
  capabilities: OrganizationCapabilities;
  availableRoleOptions: Array<{ value: string; label: string }>;
  onSetMemberRole: (
    userId: string,
    role: OrganizationRoleAssignmentInput
  ) => Promise<void>;
  onTransferOwnership: (userId: string) => Promise<void>;
  onRemoveMember: (userId: string) => Promise<void>;
}) {
  const [memberRoleDrafts, setMemberRoleDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    setMemberRoleDrafts(
      Object.fromEntries(
        props.members.map((member) => [
          member.user._id,
          member.roleType === "custom" && member.customRoleId
            ? `custom:${member.customRoleId}`
            : member.systemRole ?? member.roleName,
        ])
      )
    );
  }, [props.members]);

  const parseRoleDraftValue = (value: string): OrganizationRoleAssignmentInput => {
    if (value.startsWith("custom:")) {
      return {
        type: "custom",
        customRoleId: value.slice("custom:".length),
      };
    }
    return {
      type: "system",
      systemRole: value as "admin" | "member" | "owner",
    };
  };

  return (
    <div className="card">
      <h2>Members</h2>
      {props.members.length === 0 ? (
        <p className="muted">No members found.</p>
      ) : (
        props.members.map((member) => (
          <div key={member._id} className="card">
            <strong>{member.user.email}</strong>
            <p className="session-detail">
              Current role: <code>{member.roleName}</code>
            </p>
            {props.canManageMembers ? (
              <div className="field">
                <label htmlFor={`member-role-${member._id}`}>Assign role</label>
                <select
                  id={`member-role-${member._id}`}
                  value={memberRoleDrafts[member.user._id] ?? member.roleName}
                  onChange={(event) =>
                    setMemberRoleDrafts((current) => ({
                      ...current,
                      [member.user._id]: event.target.value,
                    }))
                  }
                  disabled={
                    member.roleName === "owner" || !props.capabilities.canUpdateMembers
                  }
                >
                  {props.availableRoleOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            <div className="actions">
              {member.roleName !== "owner" && props.canManageMembers ? (
                <>
                  {props.capabilities.canUpdateMembers ? (
                    <button
                      className="btn-secondary"
                      type="button"
                      onClick={() =>
                        void props.onSetMemberRole(
                          member.user._id,
                          parseRoleDraftValue(
                            memberRoleDrafts[member.user._id] ?? member.roleName
                          )
                        )
                      }
                    >
                      Apply role
                    </button>
                  ) : null}
                  {props.capabilities.canTransferOwnership ? (
                    <button
                      className="btn-secondary"
                      type="button"
                      onClick={() => void props.onTransferOwnership(member.user._id)}
                    >
                      Transfer ownership
                    </button>
                  ) : null}
                  {props.capabilities.canDeleteMembers ? (
                    <button
                      className="btn-danger"
                      type="button"
                      onClick={() => void props.onRemoveMember(member.user._id)}
                    >
                      Remove
                    </button>
                  ) : null}
                </>
              ) : (
                <p className="muted">
                  {member.roleName === "owner"
                    ? "Current organization owner"
                    : "You can view members but not manage them."}
                </p>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
