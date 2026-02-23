import { convexAction, useConvexMutation } from "@convex-dev/react-query";
import {
	createFileRoute,
	redirect,
	useNavigate,
} from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "convex-zen/react";
import { api } from "../../convex/_generated/api";

export const Route = createFileRoute("/admin")({
	beforeLoad: ({ context }) => {
		if (!context.isAuthenticated) {
			throw redirect({ to: "/signin" });
		}
	},
	loader: async ({ context }) => {
		await context.queryClient.ensureQueryData(
			convexAction(api.functions.listUsers, {
				limit: 50,
			}),
		);
	},
	component: AdminPage,
});

type User = {
	id: string;
	email: string;
	name?: string;
	emailVerified: boolean;
	role?: string;
	banned?: boolean;
	banReason?: string;
	createdAt: number;
};

function AdminPage() {
	const { status, session } = useAuth();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const queryOptions = convexAction(api.functions.listUsers, { limit: 50 });
	const usersQuery = useQuery(queryOptions);

	const banUserMutationFn = useConvexMutation(api.functions.banUser);
	const banUserMutation = useMutation({
		mutationFn: banUserMutationFn,
		onSuccess: async () => {
			if (queryOptions) {
				await queryClient.invalidateQueries({
					queryKey: queryOptions.queryKey,
				});
			}
		},
	});

	const setRoleMutationFn = useConvexMutation(api.functions.setRole);
	const setRoleMutation = useMutation({
		mutationFn: setRoleMutationFn,
		onSuccess: async () => {
			if (queryOptions) {
				await queryClient.invalidateQueries({
					queryKey: queryOptions.queryKey,
				});
			}
		},
	});

	if (status === "loading" || usersQuery.isPending) {
		return (
			<div>
				<h1>Admin</h1>
				<p>Loading…</p>
			</div>
		);
	}

	if (!session) {
		return (
			<div>
				<h1>Admin</h1>
				<p style={{ color: "#64748b" }}>
					You must be signed in to access this page.
				</p>
				<button
					className="btn-primary"
					style={{ marginTop: "1rem" }}
					onClick={() => void navigate({ to: "/signin" })}
				>
					Sign In
				</button>
			</div>
		);
	}

	const users = usersQuery.data?.users ?? [];
	const error =
		usersQuery.error instanceof Error ? usersQuery.error.message : "";
	const actionError =
		banUserMutation.error instanceof Error
			? banUserMutation.error.message
			: setRoleMutation.error instanceof Error
				? setRoleMutation.error.message
				: "";

	return (
		<div>
			<h1>Admin</h1>

			{error && <p className="error">{error}</p>}
			{actionError && <p className="error">{actionError}</p>}

			<div
				style={{
					display: "flex",
					justifyContent: "space-between",
					alignItems: "center",
					marginBottom: "0.75rem",
				}}
			>
				<h2 style={{ margin: 0 }}>Users ({users.length})</h2>
				<button
					className="btn-secondary"
					onClick={() =>
						queryOptions &&
						void queryClient.invalidateQueries({
							queryKey: queryOptions.queryKey,
						})
					}
					disabled={usersQuery.isRefetching}
				>
					Refresh
				</button>
			</div>

			{users.length === 0 ? (
				<p style={{ color: "#64748b" }}>No users found.</p>
			) : (
				users.map((user) => (
					<div key={user.id} className="card">
						<div
							style={{
								display: "flex",
								justifyContent: "space-between",
								alignItems: "flex-start",
							}}
						>
							<div>
								<strong>{user.email}</strong>
								{user.name && (
									<span style={{ color: "#64748b", marginLeft: "0.5rem" }}>
										({user.name})
									</span>
								)}
								<div
									style={{
										marginTop: "0.25rem",
										fontSize: "0.75rem",
										color: "#64748b",
									}}
								>
									<code>{user.id}</code>
								</div>
							</div>
							<div
								style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap" }}
							>
								{user.emailVerified ? (
									<span className="tag tag-green">verified</span>
								) : (
									<span className="tag tag-gray">unverified</span>
								)}
								{user.role && <span className="tag tag-gray">{user.role}</span>}
								{user.banned && <span className="tag tag-red">banned</span>}
							</div>
						</div>

						<div
							style={{
								display: "flex",
								gap: "0.5rem",
								marginTop: "0.75rem",
								flexWrap: "wrap",
							}}
						>
							{!user.banned && (
								<button
									className="btn-danger"
									style={{ fontSize: "0.8125rem", padding: "0.25rem 0.75rem" }}
									onClick={() => {
										const reason = window.prompt("Ban reason:");
										if (reason) {
											banUserMutation.mutate({
												userId: user.id,
												reason,
											});
										}
									}}
								>
									Ban
								</button>
							)}
							<button
								className="btn-secondary"
								style={{ fontSize: "0.8125rem", padding: "0.25rem 0.75rem" }}
								onClick={() => {
									const role = window.prompt("New role:", user.role ?? "user");
									if (role) {
										setRoleMutation.mutate({ userId: user.id, role });
									}
								}}
							>
								Set role
							</button>
						</div>

						{user.banReason && (
							<p
								style={{
									fontSize: "0.75rem",
									color: "#dc2626",
									marginTop: "0.25rem",
								}}
							>
								Ban reason: {user.banReason}
							</p>
						)}
					</div>
				))
			)}
		</div>
	);
}
