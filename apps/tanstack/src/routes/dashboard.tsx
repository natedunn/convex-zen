import { createFileRoute, redirect, useNavigate, useRouter } from "@tanstack/react-router";
import { useAuth } from "convex-zen/react";
import { authClient } from "../lib/auth-client";

export const Route = createFileRoute("/dashboard")({
  beforeLoad: ({ context }) => {
    if (!context.isAuthenticated) {
      throw redirect({ to: "/signin" });
    }
  },
  component: DashboardPage,
});

function DashboardPage() {
  const { status, session } = useAuth();
  const navigate = useNavigate();
  const router = useRouter();

  const handleSignOut = async () => {
    await authClient.signOut();
    await router.invalidate();
    void navigate({ to: "/" });
  };

  if (status === "loading") {
    return (
      <div>
        <h1>Dashboard</h1>
        <p>Loading…</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div>
        <h1>Dashboard</h1>
        <p style={{ color: "#64748b" }}>You are not signed in.</p>
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
      <h1>Dashboard</h1>

      <div className="card">
        <h2>Session</h2>
        <p>
          <span className="tag tag-green">Active</span>
        </p>
        <p style={{ fontSize: "0.875rem", color: "#64748b", marginTop: "0.5rem" }}>
          User ID: <code>{session.userId}</code>
        </p>
        <p style={{ fontSize: "0.875rem", color: "#64748b" }}>
          Session ID: <code>{session.sessionId}</code>
        </p>
      </div>

      <p style={{ color: "#64748b", fontSize: "0.875rem", marginBottom: "1rem" }}>
        Session tokens are stored in an HttpOnly cookie and never exposed to client code.
      </p>

      <button className="btn-danger" onClick={() => void handleSignOut()}>
        Sign Out
      </button>
    </div>
  );
}
