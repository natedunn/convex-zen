import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "convex-zen/react";
import { useEffect, useState } from "react";
import type { FunctionArgs } from "convex/server";
import { api } from "../../convex/_generated/api";
import { authClient } from "../lib/auth-client";

type User = {
	_id: string;
	email: string;
	name?: string;
	emailVerified: boolean;
	role?: string;
	banned?: boolean;
	banReason?: string;
	createdAt: number;
};

type AdminListUsersResponse = {
	users: User[];
	cursor: string | null;
	isDone: boolean;
};

type ListUsersArgs = FunctionArgs<typeof api.auth.plugin.admin.listUsers>;

const listAdminUsersServerFn = createServerFn({ method: "POST" })
	.inputValidator(
		(input: ListUsersArgs | undefined): ListUsersArgs => input ?? {},
	)
	.handler(async ({ data }) => {
		const { fetchAuthQuery } = await import("../lib/auth-server");
		return fetchAuthQuery(api.auth.plugin.admin.listUsers, data);
	});

export const Route = createFileRoute("/admin")({
	preload: false,
	staleTime: 0,
	gcTime: 0,
	loader: async ({ context }) => {
		if (!context.isAuthenticated) {
			throw redirect({ to: "/signin" });
		}
		try {
			const result = (await listAdminUsersServerFn({
				data: {
					limit: 50,
				},
			})) as AdminListUsersResponse;
			return {
				users: result.users,
			};
		} catch (error) {
			const message = error instanceof Error ? error.message : "Forbidden";
			if (message.includes("Unauthorized")) {
				throw redirect({ to: "/signin" });
			}
			if (message.includes("Forbidden")) {
				throw redirect({ to: "/dashboard" });
			}
			throw error;
		}
	},
	component: AdminPage,
	errorComponent: ({ error }) => {
		const message = error instanceof Error ? error.message : "Unknown error";
		return (
			<div>
				<h1>Admin</h1>
				<p className="error">Could not load admin page: {message}</p>
			</div>
		);
	},
});

function AdminPage() {
	const { users: prefetchedUsers } = Route.useLoaderData();
	const { status, session } = useAuth();
	const navigate = useNavigate();
	const [users, setUsers] = useState(prefetchedUsers);
	const [error, setError] = useState("");
	useEffect(() => {
		setUsers(prefetchedUsers);
	}, [prefetchedUsers]);

	const banUserMutation = useMutation({
		mutationFn: async (input: { userId: string; reason?: string }) =>
			authClient.plugin.admin.banUser(input),
		onSuccess: (_result, input) => {
			setUsers((current) =>
				current.map((user) =>
					user._id === input.userId
						? { ...user, banned: true, banReason: input.reason }
						: user,
				),
			);
		},
		onError: (mutationError) => {
			setError(
				mutationError instanceof Error
					? mutationError.message
					: "Could not ban user",
			);
		},
	});

	const unbanUserMutation = useMutation({
		mutationFn: async (input: { userId: string }) =>
			authClient.plugin.admin.unbanUser(input),
		onSuccess: (_result, input) => {
			setUsers((current) =>
				current.map((user) =>
					user._id === input.userId
						? { ...user, banned: false, banReason: undefined }
						: user,
				),
			);
		},
		onError: (mutationError) => {
			setError(
				mutationError instanceof Error
					? mutationError.message
					: "Could not unban user",
			);
		},
	});

	const setRoleMutation = useMutation({
		mutationFn: async (input: { userId: string; role: string }) =>
			authClient.plugin.admin.setRole(input),
		onSuccess: (_result, input) => {
			setUsers((current) =>
				current.map((user) =>
					user._id === input.userId ? { ...user, role: input.role } : user,
				),
			);
		},
		onError: (mutationError) => {
			setError(
				mutationError instanceof Error
					? mutationError.message
					: "Could not set role",
			);
		},
	});

	if (status === "loading") {
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

	return (
		<div>
			<h1>Admin</h1>
			{error ? <p className="error">{error}</p> : null}

			<div
				style={{
					display: "flex",
					justifyContent: "space-between",
					alignItems: "center",
					marginBottom: "0.75rem",
				}}
			>
				<h2 style={{ margin: 0 }}>Users ({users.length})</h2>
			</div>

			{users.length === 0 ? (
				<p style={{ color: "#64748b" }}>No users found.</p>
			) : (
				users.map((user) => (
					<div key={user._id} className="card">
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
									<code>{user._id}</code>
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
												userId: user._id,
												reason,
											});
										}
									}}
								>
									Ban
								</button>
							)}
							{user.banned && (
								<button
									className="btn-secondary"
									style={{ fontSize: "0.8125rem", padding: "0.25rem 0.75rem" }}
									onClick={() => {
										unbanUserMutation.mutate({
											userId: user._id,
										});
									}}
								>
									Unban
								</button>
							)}
							<button
								className="btn-secondary"
								style={{ fontSize: "0.8125rem", padding: "0.25rem 0.75rem" }}
								onClick={() => {
									const role = window.prompt("New role:", user.role ?? "user");
									if (role) {
										setRoleMutation.mutate({
											userId: user._id,
											role,
										});
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
