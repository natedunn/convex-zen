import { useState } from "react";
import type {
  OrganizationCapabilities,
  OrganizationInvitation,
  OrganizationRole,
  OrganizationRoleAssignmentInput,
} from "./organizationPlaygroundShared";
import {
  formatTimestamp,
  SYSTEM_ROLE_OPTIONS,
} from "./organizationPlaygroundShared";

export function InvitationsCard(props: {
  capabilities: OrganizationCapabilities;
  roles: OrganizationRole[];
  invitations: OrganizationInvitation[];
  onInviteMember: (args: {
    email: string;
    role: OrganizationRoleAssignmentInput;
  }) => Promise<string>;
  onAcceptInvitationByToken: (token: string) => Promise<void>;
}) {
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRoleKind, setInviteRoleKind] = useState<"system" | "custom">(
    "system"
  );
  const [inviteSystemRole, setInviteSystemRole] = useState<"admin" | "member">(
    "member"
  );
  const [inviteCustomRoleId, setInviteCustomRoleId] = useState("");
  const [acceptInvitationToken, setAcceptInvitationToken] = useState("");
  const [lastInvitationToken, setLastInvitationToken] = useState<string | null>(null);

  const handleInvite = async (event: React.FormEvent) => {
    event.preventDefault();
    const role: OrganizationRoleAssignmentInput =
      inviteRoleKind === "custom"
        ? { type: "custom", customRoleId: inviteCustomRoleId }
        : { type: "system", systemRole: inviteSystemRole };
    const token = await props.onInviteMember({
      email: inviteEmail,
      role,
    });
    setInviteEmail("");
    setInviteCustomRoleId("");
    setLastInvitationToken(token);
  };

  const handleAccept = async (event: React.FormEvent) => {
    event.preventDefault();
    await props.onAcceptInvitationByToken(acceptInvitationToken);
    setAcceptInvitationToken("");
  };

  return (
    <div className="card">
      <h2>Invite member</h2>
      {props.capabilities.canCreateInvitations ? (
        <form onSubmit={(event) => void handleInvite(event)}>
          <div className="field">
            <label htmlFor="invite-email">Email</label>
            <input
              id="invite-email"
              value={inviteEmail}
              onChange={(event) => setInviteEmail(event.target.value)}
              placeholder="teammate@example.com"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="invite-role-kind">Role type</label>
            <select
              id="invite-role-kind"
              value={inviteRoleKind}
              onChange={(event) =>
                setInviteRoleKind(event.target.value as "system" | "custom")
              }
            >
              <option value="system">System role</option>
              <option value="custom">Custom role</option>
            </select>
          </div>
          {inviteRoleKind === "system" ? (
            <div className="field">
              <label htmlFor="invite-system-role">System role</label>
              <select
                id="invite-system-role"
                value={inviteSystemRole}
                onChange={(event) =>
                  setInviteSystemRole(event.target.value as "admin" | "member")
                }
              >
                {SYSTEM_ROLE_OPTIONS.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="field">
              <label htmlFor="invite-custom-role">Custom role</label>
              <select
                id="invite-custom-role"
                value={inviteCustomRoleId}
                onChange={(event) => setInviteCustomRoleId(event.target.value)}
              >
                <option value="">Select a role</option>
                {props.roles.map((role) => (
                  <option key={role._id} value={role._id}>
                    {role.slug}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="actions">
            <button className="btn-primary" type="submit">
              Send invite
            </button>
          </div>
        </form>
      ) : (
        <p className="muted">You do not have permission to send invitations.</p>
      )}

      {props.capabilities.canCreateInvitations && lastInvitationToken ? (
        <>
          <hr className="card-divider" />
          <p className="section-label">Latest invite token</p>
          <p className="muted">
            For local testing, copy this token into the recipient account&apos;s
            accept form.
          </p>
          <pre>
            <code>{lastInvitationToken}</code>
          </pre>
        </>
      ) : null}

      <hr className="card-divider" />

      {props.capabilities.canReadInvitations ? (
        <>
          <p className="section-label">Invitations ({props.invitations.length})</p>
          {props.invitations.length === 0 ? (
            <p className="muted">No invitations yet.</p>
          ) : (
            props.invitations.map((invitation) => (
              <div key={invitation._id} className="card">
                <strong>{invitation.email}</strong>
                <p className="session-detail">
                  Role: <code>{invitation.roleName}</code>
                </p>
                <p className="session-detail">
                  Accepted: {formatTimestamp(invitation.acceptedAt)}
                </p>
                <p className="session-detail">
                  Cancelled: {formatTimestamp(invitation.cancelledAt)}
                </p>
                <p className="session-detail">
                  Declined: {formatTimestamp(invitation.declinedAt)}
                </p>
                <p className="session-detail">
                  Expires: {formatTimestamp(invitation.expiresAt)}
                </p>
              </div>
            ))
          )}
        </>
      ) : (
        <p className="muted">You do not have permission to view invitations.</p>
      )}

      <hr className="card-divider" />

      <h2>Accept invitation</h2>
      <p className="muted">
        Current support is token-based. The signed-in user&apos;s email must match
        the invitation email.
      </p>
      <form onSubmit={(event) => void handleAccept(event)}>
        <div className="field">
          <label htmlFor="accept-invitation-token">Invitation token</label>
          <input
            id="accept-invitation-token"
            value={acceptInvitationToken}
            onChange={(event) => setAcceptInvitationToken(event.target.value)}
            placeholder="Paste the raw invitation token"
            required
          />
        </div>
        <div className="actions">
          <button className="btn-primary" type="submit">
            Accept invitation
          </button>
        </div>
      </form>
    </div>
  );
}
