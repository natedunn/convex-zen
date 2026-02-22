import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAction } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "../../convex/_generated/api";

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const validateSession = useAction(api.functions.validateSession);
  const signOut = useAction(api.functions.signOut);
  const navigate = useNavigate();

  const [session, setSession] = useState<{
    userId: string;
    sessionId: string;
  } | null | "loading">("loading");

  const token =
    typeof window !== "undefined" ? localStorage.getItem("sessionToken") : null;

  useEffect(() => {
    if (!token) {
      setSession(null);
      return;
    }
    validateSession({ token })
      .then((result) =>
        setSession(result as { userId: string; sessionId: string } | null)
      )
      .catch(() => setSession(null));
  }, [token]);

  const handleSignOut = async () => {
    if (token) {
      try {
        await signOut({ token });
      } catch {
        // ignore
      }
      localStorage.removeItem("sessionToken");
    }
    void navigate({ to: "/" });
  };

  if (session === "loading") {
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
        <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem" }}>
          <button
            className="btn-primary"
            onClick={() => void navigate({ to: "/signin" })}
          >
            Sign In
          </button>
          <button
            className="btn-secondary"
            onClick={() => void navigate({ to: "/signup" })}
          >
            Sign Up
          </button>
        </div>
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

      <div className="card">
        <h2>Session Token</h2>
        <p
          style={{
            fontSize: "0.75rem",
            color: "#64748b",
            fontFamily: "monospace",
            wordBreak: "break-all",
          }}
        >
          {token}
        </p>
      </div>

      <button className="btn-danger" onClick={() => void handleSignOut()}>
        Sign Out
      </button>
    </div>
  );
}
