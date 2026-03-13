import {
	createFileRoute,
	Link,
	redirect,
	useNavigate,
} from "@tanstack/react-router";
import { useZenSession } from "convex-zen/react";
import { OrganizationPlayground } from "../components/organization-playground";

export const Route = createFileRoute("/organizations")({
	beforeLoad: ({ context }) => {
		if (!context.isAuthenticated) {
			throw redirect({ to: "/signin" });
		}
	},
	component: OrganizationsPage,
});

function OrganizationsPage() {
	const { status, session } = useZenSession();
	const navigate = useNavigate();

	if (status === "loading") {
		return (
			<div className="card">
				<h2>Organizations</h2>
				<p className="loading-text">Loading...</p>
			</div>
		);
	}

	if (!session) {
		return (
			<div className="card">
				<h2>Organizations</h2>
				<p className="muted">You must be signed in to access this page.</p>
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
			<h2 className="page-title">Organizations</h2>
			<p className="muted">
				Exercise the organization plugin through the generated TanStack auth
				routes.
			</p>

			<OrganizationPlayground />

			<div className="flow-links">
				<Link to="/dashboard">Back to dashboard</Link>
				<Link to="/">Back to diagnostics</Link>
			</div>
		</>
	);
}
