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

	useEffect(() => {
		let cancelled = false;

		if (!session) {
			setUser(null);
			return () => {
				cancelled = true;
			};
		}

		void authClient
			.currentUser()
			.then((currentUser) => {
				if (!cancelled) {
					setUser(currentUser);
				}
			})
			.catch(() => {
				if (!cancelled) {
					setUser(null);
				}
			});

		return () => {
			cancelled = true;
		};
	}, [session]);

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

			<div className="flow-links">
				<Link to="/">Back to diagnostics</Link>
			</div>
		</>
	);
}
