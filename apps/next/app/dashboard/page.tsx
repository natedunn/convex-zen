"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { SessionCard } from "@convex-zen/playground-ui";

type Session = {
  userId: string;
  sessionId: string;
} | null;

type OrganizationListEntry = {
  organization: {
    _id: string;
    name: string;
    slug: string;
  };
  membership: {
    roleName: string;
  };
};

type OrganizationListResult = {
  organizations: OrganizationListEntry[];
};

type IncomingInvitationEntry = {
  _id: string;
  organization: {
    name: string;
    slug: string;
  };
  roleName: string;
};

export default function DashboardPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session>(null);
  const [email, setEmail] = useState<string | undefined>();
  const [organizations, setOrganizations] = useState<
    Array<{ _id: string; name: string; slug: string; roleName: string }>
  >([]);
  const [incomingInvitations, setIncomingInvitations] = useState<
    Array<{ _id: string; organizationName: string; organizationSlug: string; roleName: string }>
  >([]);
  const [inviteActionId, setInviteActionId] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  const loadSession = async () => {
    setLoading(true);
    try {
      const s = await authClient.getSession();
      if (!s) {
        router.replace("/signin");
        return;
      }
      setSession(s);
      try {
        const [user, organizationResult, incomingResult] = await Promise.all([
          authClient.currentUser(),
          authClient.plugin.organization.listOrganizations(),
          authClient.plugin.organization.listIncomingInvitations(),
        ]);
        setEmail(user?.email);
        setOrganizations(
          (organizationResult as OrganizationListResult).organizations.map(
            (entry: OrganizationListEntry) => ({
            _id: entry.organization._id,
            name: entry.organization.name,
            slug: entry.organization.slug,
            roleName: entry.membership.roleName,
            })
          )
        );
        setIncomingInvitations(
          (incomingResult as IncomingInvitationEntry[]).map(
            (invitation: IncomingInvitationEntry) => ({
            _id: invitation._id,
            organizationName: invitation.organization.name,
            organizationSlug: invitation.organization.slug,
            roleName: invitation.roleName,
            })
          )
        );
        setInviteError(null);
      } catch {
        // email is best-effort
      }
    } catch {
      router.replace("/signin");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSession();
  }, []);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await authClient.signOut();
      router.replace("/");
    } catch {
      setSigningOut(false);
    }
  };

  const handleIncomingInvitation = async (
    invitationId: string,
    action: "accept" | "decline"
  ) => {
    setInviteActionId(invitationId);
    setInviteError(null);
    try {
      if (action === "accept") {
        await authClient.plugin.organization.acceptIncomingInvitation({
          invitationId,
        });
      } else {
        await authClient.plugin.organization.declineIncomingInvitation({
          invitationId,
        });
      }
      await loadSession();
    } catch (error) {
      setInviteError(error instanceof Error ? error.message : "Unable to update invitation");
    } finally {
      setInviteActionId(null);
    }
  };

  if (loading || !session) {
    return (
      <div className="card">
        <h2>Dashboard</h2>
        <p className="loading-text">Loading...</p>
      </div>
    );
  }

  return (
    <>
      <h2 className="page-title">Dashboard</h2>

      <SessionCard
        userId={session.userId}
        sessionId={session.sessionId}
        email={email}
        onSignOut={handleSignOut}
        onRefresh={() => void loadSession()}
        signingOut={signingOut}
      />

      <p className="muted">
        Session tokens are stored in an HttpOnly cookie and never exposed to
        client code.
      </p>

      <div className="card">
        <h2>Organization summary</h2>
        {organizations.length === 0 ? (
          <p className="muted">You are not a member of any organizations yet.</p>
        ) : (
          organizations.map((organization) => (
            <p key={organization._id} className="session-detail">
              <strong>{organization.name}</strong> <code>{organization.slug}</code> as{" "}
              <code>{organization.roleName}</code>
            </p>
          ))
        )}
      </div>

      <div className="card">
        <h2>Incoming invites</h2>
        {inviteError ? <p className="status status-error">{inviteError}</p> : null}
        {incomingInvitations.length === 0 ? (
          <p className="muted">No pending organization invitations.</p>
        ) : (
          incomingInvitations.map((invitation) => (
            <div key={invitation._id}>
              <p className="session-detail">
                <strong>{invitation.organizationName}</strong>{" "}
                <code>{invitation.organizationSlug}</code> as{" "}
                <code>{invitation.roleName}</code>
              </p>
              <div className="actions">
                <button
                  className="btn-primary"
                  disabled={inviteActionId === invitation._id}
                  onClick={() => void handleIncomingInvitation(invitation._id, "accept")}
                >
                  {inviteActionId === invitation._id ? "Working..." : "Accept"}
                </button>
                <button
                  className="btn-secondary"
                  disabled={inviteActionId === invitation._id}
                  onClick={() => void handleIncomingInvitation(invitation._id, "decline")}
                >
                  Decline
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="flow-links">
        <Link href="/organizations">Organization playground</Link>
        <Link href="/system-admin">System Admin playground</Link>
        <Link href="/">Back to diagnostics</Link>
      </div>
    </>
  );
}
