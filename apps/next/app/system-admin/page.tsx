"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { UserRow, type UserRowData } from "@convex-zen/playground-ui";

type SystemAdminListUsersResult = {
  users: UserRowData[];
};

export default function SystemAdminPage() {
  const router = useRouter();
  const [users, setUsers] = useState<UserRowData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const session = await authClient.getSession();
      if (!session) {
        router.replace("/signin");
        return;
      }
      const result = (await authClient.plugin.systemAdmin.listUsers({
        limit: 50,
      })) as SystemAdminListUsersResult;
      setUsers(result.users);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not load users";
      if (message.includes("Unauthorized")) {
        router.replace("/signin");
        return;
      }
      if (message.includes("Forbidden")) {
        router.replace("/dashboard");
        return;
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadUsers();
  }, []);

  const handleBan = async (userId: string) => {
    const reason = window.prompt("Ban reason:");
    if (!reason) return;
    try {
      await authClient.plugin.systemAdmin.banUser({ userId, reason });
      setUsers((current) =>
        current.map((u) =>
          u._id === userId ? { ...u, banned: true, banReason: reason } : u
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not ban user");
    }
  };

  const handleUnban = async (userId: string) => {
    try {
      await authClient.plugin.systemAdmin.unbanUser({ userId });
      setUsers((current) =>
        current.map((u) =>
          u._id === userId ? { ...u, banned: false, banReason: undefined } : u
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not unban user");
    }
  };

  const handleSetRole = async (userId: string) => {
    const currentUser = users.find((u) => u._id === userId);
    const role = window.prompt("New role:", currentUser?.role ?? "user");
    if (!role) return;
    try {
      await authClient.plugin.systemAdmin.setRole({ userId, role });
      setUsers((current) =>
        current.map((u) => (u._id === userId ? { ...u, role } : u))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not set role");
    }
  };

  if (loading) {
    return (
      <div className="card">
        <h2>System Admin</h2>
        <p className="loading-text">Loading...</p>
      </div>
    );
  }

  return (
    <>
      <h2 className="page-title">System Admin</h2>
      {error && <p className="text-error">{error}</p>}

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
            onBan={(id) => void handleBan(id)}
            onUnban={(id) => void handleUnban(id)}
            onSetRole={(id) => void handleSetRole(id)}
          />
        ))
      )}
    </>
  );
}
