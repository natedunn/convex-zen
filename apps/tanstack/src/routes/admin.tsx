import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAction } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "../../convex/_generated/api";

export const Route = createFileRoute("/admin")({
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
  const validateSession = useAction(api.functions.validateSession);
  const listUsers = useAction(api.functions.listUsers);
  const banUser = useAction(api.functions.banUser);
  const setRole = useAction(api.functions.setRole);
  const navigate = useNavigate();

  const [authed, setAuthed] = useState<"loading" | boolean>("loading");
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");

  const token =
    typeof window !== "undefined" ? localStorage.getItem("sessionToken") : null;

  useEffect(() => {
    if (!token) {
      setAuthed(false);
      return;
    }
    validateSession({ token })
      .then((result) => {
        setAuthed(result !== null);
        if (result !== null) loadUsers();
      })
      .catch(() => setAuthed(false));
  }, [token]);

  const loadUsers = () => {
    if (!token) {
      setError("You must be signed in.");
      return;
    }

    listUsers({ token, limit: 50 })
      .then((result) => {
        const r = result as { users: User[] };
        setUsers(r.users);
      })
      .catch((err: Error) => setError(err.message));
  };

  const handleBan = async (userId: string, reason: string) => {
    if (!token) {
      setActionError("You must be signed in.");
      return;
    }

    setActionError("");
    try {
      await banUser({ token, userId, reason });
      loadUsers();
    } catch (err) {
      setActionError((err as Error).message);
    }
  };

  const handleSetRole = async (userId: string, role: string) => {
    if (!token) {
      setActionError("You must be signed in.");
      return;
    }

    setActionError("");
    try {
      await setRole({ token, userId, role });
      loadUsers();
    } catch (err) {
      setActionError((err as Error).message);
    }
  };

  if (authed === "loading") {
    return (
      <div>
        <h1>Admin</h1>
        <p>Loading…</p>
      </div>
    );
  }

  if (!authed) {
    return (
      <div>
        <h1>Admin</h1>
        <p style={{ color: "#64748b" }}>You must be signed in to access this page.</p>
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

      {error && <p className="error">{error}</p>}
      {actionError && <p className="error">{actionError}</p>}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
        <h2 style={{ margin: 0 }}>Users ({users.length})</h2>
        <button className="btn-secondary" onClick={loadUsers}>
          Refresh
        </button>
      </div>

      {users.length === 0 ? (
        <p style={{ color: "#64748b" }}>No users found.</p>
      ) : (
        users.map((user) => (
          <div key={user.id} className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <strong>{user.email}</strong>
                {user.name && (
                  <span style={{ color: "#64748b", marginLeft: "0.5rem" }}>
                    ({user.name})
                  </span>
                )}
                <div style={{ marginTop: "0.25rem", fontSize: "0.75rem", color: "#64748b" }}>
                  <code>{user.id}</code>
                </div>
              </div>
              <div style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap" }}>
                {user.emailVerified ? (
                  <span className="tag tag-green">verified</span>
                ) : (
                  <span className="tag tag-gray">unverified</span>
                )}
                {user.role && (
                  <span className="tag tag-gray">{user.role}</span>
                )}
                {user.banned && (
                  <span className="tag tag-red">banned</span>
                )}
              </div>
            </div>

            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem", flexWrap: "wrap" }}>
              {!user.banned && (
                <button
                  className="btn-danger"
                  style={{ fontSize: "0.8125rem", padding: "0.25rem 0.75rem" }}
                  onClick={() => {
                    const reason = window.prompt("Ban reason:");
                    if (reason) void handleBan(user.id, reason);
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
                  if (role) void handleSetRole(user.id, role);
                }}
              >
                Set role
              </button>
            </div>

            {user.banReason && (
              <p style={{ fontSize: "0.75rem", color: "#dc2626", marginTop: "0.25rem" }}>
                Ban reason: {user.banReason}
              </p>
            )}
          </div>
        ))
      )}
    </div>
  );
}
