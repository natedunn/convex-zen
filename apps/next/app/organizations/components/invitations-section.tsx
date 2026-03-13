"use client";

import { useState } from "react";
import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { FunctionReturnType } from "convex/server";
import { authApi } from "@/lib/auth-refs";
import {
  buildRoleOptions,
  formatTimestamp,
  messageFromError,
  parseRoleValue,
} from "./organization-playground-shared";

export function InvitationsSection({
  organizationId,
  onMembershipChanged,
}: {
  organizationId: string;
  onMembershipChanged: () => Promise<unknown>;
}) {
  const invitationsQuery = useQuery(
    convexQuery(authApi.plugin.organization.listInvitations, {
      organizationId,
    })
  );
  const rolesQuery = useQuery(
    convexQuery(authApi.plugin.organization.listRoles, { organizationId })
  );
  const canCreateInvitationQuery = useQuery(
    convexQuery(authApi.plugin.organization.hasPermission, {
      organizationId,
      permission: { resource: "invitation", action: "create" },
    })
  );

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRoleValue, setInviteRoleValue] = useState("member");
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [acceptToken, setAcceptToken] = useState("");

  const roleOptions = buildRoleOptions(rolesQuery.data?.roles ?? []);
  const inviteMemberMutation = useMutation({
    mutationFn: useConvexMutation(authApi.plugin.organization.inviteMember),
    onSuccess: (
      result: FunctionReturnType<typeof authApi.plugin.organization.inviteMember>
    ) => {
      setInviteEmail("");
      setInviteRoleValue("member");
      setInviteToken(result.token);
      void invitationsQuery.refetch();
    },
  });
  const acceptByTokenMutation = useMutation({
    mutationFn: useConvexMutation(authApi.plugin.organization.acceptInvitation),
    onSuccess: async () => {
      setAcceptToken("");
      await Promise.all([invitationsQuery.refetch(), onMembershipChanged()]);
    },
  });

  return (
    <div className="card">
      <h2>Invitations</h2>
      {invitationsQuery.error ? (
        <p className="text-error">
          {messageFromError(invitationsQuery.error, "Could not load invitations")}
        </p>
      ) : null}
      {inviteMemberMutation.error ? (
        <p className="text-error">
          {messageFromError(inviteMemberMutation.error, "Could not invite member")}
        </p>
      ) : null}
      {acceptByTokenMutation.error ? (
        <p className="text-error">
          {messageFromError(
            acceptByTokenMutation.error,
            "Could not accept invitation"
          )}
        </p>
      ) : null}
      {inviteMemberMutation.isSuccess ? (
        <p className="text-success">Invitation created</p>
      ) : null}
      {acceptByTokenMutation.isSuccess ? (
        <p className="text-success">Invitation accepted</p>
      ) : null}
      {invitationsQuery.isLoading ? (
        <p className="loading-text">Loading invitations...</p>
      ) : null}

      {canCreateInvitationQuery.data ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            inviteMemberMutation.mutate({
              organizationId,
              email: inviteEmail,
              role: parseRoleValue(inviteRoleValue),
            });
          }}
        >
          <div className="field">
            <label htmlFor="invite-email">Invite email</label>
            <input
              id="invite-email"
              value={inviteEmail}
              onChange={(event) => setInviteEmail(event.target.value)}
              placeholder="user@example.com"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="invite-role">Invite role</label>
            <select
              id="invite-role"
              value={inviteRoleValue}
              onChange={(event) => setInviteRoleValue(event.target.value)}
            >
              {roleOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="actions">
            <button
              className="btn-primary"
              type="submit"
              disabled={inviteMemberMutation.isPending}
            >
              {inviteMemberMutation.isPending ? "Inviting..." : "Invite member"}
            </button>
          </div>
        </form>
      ) : (
        <p className="muted">You do not have permission to create invitations.</p>
      )}

      {inviteToken ? (
        <p className="session-detail">
          Last invite token: <code>{inviteToken}</code>
        </p>
      ) : null}

      <hr className="card-divider" />

      <form
        onSubmit={(event) => {
          event.preventDefault();
          acceptByTokenMutation.mutate({ token: acceptToken });
        }}
      >
        <div className="field">
          <label htmlFor="accept-token">Accept invitation by token</label>
          <input
            id="accept-token"
            value={acceptToken}
            onChange={(event) => setAcceptToken(event.target.value)}
            placeholder="Paste the invite token"
            required
          />
        </div>
        <div className="actions">
          <button
            className="btn-secondary"
            type="submit"
            disabled={acceptByTokenMutation.isPending}
          >
            {acceptByTokenMutation.isPending ? "Accepting..." : "Accept invitation"}
          </button>
        </div>
      </form>

      <hr className="card-divider" />

      {invitationsQuery.isError ? (
        <p className="muted">You do not have permission to view invites.</p>
      ) : (invitationsQuery.data?.length ?? 0) === 0 ? (
        <p className="muted">No outgoing invitations.</p>
      ) : (
        invitationsQuery.data!.map((invitation) => (
          <div key={invitation._id} className="card">
            <strong>{invitation.email}</strong>
            <p className="session-detail">Role: {invitation.roleName}</p>
            <p className="session-detail">
              Expires: {formatTimestamp(invitation.expiresAt)}
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
          </div>
        ))
      )}
    </div>
  );
}
