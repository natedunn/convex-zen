import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useSession } from "convex-zen/react";
import { useEffect, useState } from "react";
import type { FunctionArgs } from "convex/server";
import { api } from "../../convex/_generated/api";
import { authClient } from "../lib/auth-client";
import { UserRow, type UserRowData } from "@convex-zen/playground-ui";

type AdminListUsersResponse = {
	users: UserRowData[];
	cursor: string | null;
	isDone: boolean;
};

type ListUsersArgs = FunctionArgs<typeof api.zen.plugin.admin.listUsers>;

const listAdminUsersServerFn = createServerFn({ method: "POST" })
	.inputValidator(
		(input: ListUsersArgs | undefined): ListUsersArgs => input ?? {},
	)
	.handler(async ({ data }) => {
		const { fetchAuthQuery } = await import("../lib/auth-server");
		return fetchAuthQuery(api.zen.plugin.admin.listUsers, data);
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
			<div className="card">
				<h2>Admin</h2>
				<p className="text-error">Could not load admin page: {message}</p>
			</div>
		);
	},
});

function AdminPage() {
	const { users: prefetchedUsers } = Route.useLoaderData();
	const { status, session } = useSession();
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
			<div className="card">
				<h2>Admin</h2>
				<p className="loading-text">Loading...</p>
			</div>
		);
	}

	if (!session) {
		return (
			<div className="card">
				<h2>Admin</h2>
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
			<h2 className="page-title">Admin</h2>
			{error ? <p className="text-error">{error}</p> : null}

			<p className="section-label">Users ({users.length})</p>

			{users.length === 0 ? (
				<div className="card">
					<p className="muted">No users found.</p>
				</div>
			) : (
				users.map((user) => (
					<UserRow
						key={user._id}
						user={user}
						onBan={(id) => {
							const reason = window.prompt("Ban reason:");
							if (reason) {
								banUserMutation.mutate({ userId: id, reason });
							}
						}}
						onUnban={(id) => {
							unbanUserMutation.mutate({ userId: id });
						}}
						onSetRole={(id) => {
							const currentUser = users.find((u) => u._id === id);
							const role = window.prompt(
								"New role:",
								currentUser?.role ?? "user",
							);
							if (role) {
								setRoleMutation.mutate({ userId: id, role });
							}
						}}
					/>
				))
			)}
		</>
	);
}
