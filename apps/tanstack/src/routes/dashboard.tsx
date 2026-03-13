import {
	createFileRoute,
	redirect,
	Link,
	useNavigate,
	useRouter,
} from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useSession } from "convex-zen/react";
import { authClient } from "../lib/auth-client";
import { SessionCard } from "@convex-zen/playground-ui";

export const Route = createFileRoute("/dashboard")({
	beforeLoad: ({ context }) => {
		if (!context.isAuthenticated) {
			throw redirect({ to: "/signin" });
		}
	},
	component: DashboardPage,
});

function DashboardPage() {
	const { status, session } = useSession();
	const navigate = useNavigate();
	const router = useRouter();
	const [user, setUser] = useState<{ email?: string } | null>(null);
	const [organizations, setOrganizations] = useState<
		Array<{ _id: string; name: string; slug: string; roleName: string }>
	>([]);
	const [incomingInvitations, setIncomingInvitations] = useState<
		Array<{ _id: string; organizationName: string; organizationSlug: string; roleName: string }>
	>([]);
	const [inviteActionId, setInviteActionId] = useState<string | null>(null);
	const [inviteError, setInviteError] = useState<string | null>(null);

	const loadDashboardData = async () => {
		const currentUser = await authClient.currentUser();
		const [organizationResult, incomingResult] = await Promise.all([
			authClient.plugin.organization.listOrganizations(),
			authClient.plugin.organization.listIncomingInvitations(),
		]);
		setUser(currentUser);
		setOrganizations(
			organizationResult.organizations.map((entry) => ({
				_id: entry.organization._id,
				name: entry.organization.name,
				slug: entry.organization.slug,
				roleName: entry.membership.roleName,
			})),
		);
		setIncomingInvitations(
			incomingResult.map((invitation) => ({
				_id: invitation._id,
				organizationName: invitation.organization.name,
				organizationSlug: invitation.organization.slug,
				roleName: invitation.roleName,
			})),
		);
		setInviteError(null);
	};

	useEffect(() => {
		let cancelled = false;

		if (!session) {
			setUser(null);
			return () => {
				cancelled = true;
			};
		}

			void Promise.all([
				authClient.currentUser(),
				authClient.plugin.organization.listOrganizations(),
				authClient.plugin.organization.listIncomingInvitations(),
			])
				.then(([currentUser, organizationResult, incomingResult]) => {
					if (!cancelled) {
						setUser(currentUser);
						setOrganizations(
							organizationResult.organizations.map((entry) => ({
								_id: entry.organization._id,
								name: entry.organization.name,
								slug: entry.organization.slug,
								roleName: entry.membership.roleName,
							})),
						);
						setIncomingInvitations(
							incomingResult.map((invitation) => ({
								_id: invitation._id,
								organizationName: invitation.organization.name,
								organizationSlug: invitation.organization.slug,
								roleName: invitation.roleName,
							})),
						);
						setInviteError(null);
					}
				})
				.catch(() => {
					if (!cancelled) {
						setUser(null);
					setOrganizations([]);
					setIncomingInvitations([]);
				}
				});

		return () => {
			cancelled = true;
		};
	}, [session]);

	const handleIncomingInvitation = async (
		invitationId: string,
		action: "accept" | "decline",
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
			await loadDashboardData();
		} catch (error) {
			setInviteError(
				error instanceof Error ? error.message : "Unable to update invitation",
			);
		} finally {
			setInviteActionId(null);
		}
	};

	const handleSignOut = async () => {
		await authClient.signOut();
		await router.invalidate();
		void navigate({ to: "/" });
	};

	if (status === "loading") {
		return (
			<div className="card">
				<h2>Dashboard</h2>
				<p className="loading-text">Loading...</p>
			</div>
		);
	}

	if (!session) {
		return (
			<div className="card">
				<h2>Dashboard</h2>
				<p className="muted">You are not signed in.</p>
				<div className="actions">
					<button
						className="btn-primary"
						onClick={() => void navigate({ to: "/signin" })}
					>
						Sign In
					</button>
				</div>
			</div>
		);
	}

	return (
		<>
			<h2 className="page-title">Dashboard</h2>

			<SessionCard
				userId={session.userId}
				sessionId={session.sessionId}
				email={user?.email}
				onSignOut={() => void handleSignOut()}
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
							<strong>{organization.name}</strong> <code>{organization.slug}</code>{" "}
							as <code>{organization.roleName}</code>
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
										onClick={() =>
											void handleIncomingInvitation(invitation._id, "accept")
										}
									>
										{inviteActionId === invitation._id ? "Working..." : "Accept"}
									</button>
									<button
										className="btn-secondary"
										disabled={inviteActionId === invitation._id}
										onClick={() =>
											void handleIncomingInvitation(invitation._id, "decline")
										}
									>
										Decline
									</button>
								</div>
							</div>
						))
					)}
				</div>

			<div className="flow-links">
				<Link to="/organizations">Organization playground</Link>
				<Link to="/admin">Admin playground</Link>
				<Link to="/">Back to diagnostics</Link>
			</div>
		</>
	);
}
