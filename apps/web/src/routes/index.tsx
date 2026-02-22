import { createFileRoute, Link } from "@tanstack/react-router";
import { useAction } from "convex/react";
import { useState } from "react";
import { api } from "../../convex/_generated/api";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  const validateSession = useAction(api.functions.validateSession);
  const [session, setSession] = useState<{
    userId: string;
    sessionId: string;
  } | null | "loading">("loading");

  const token =
    typeof window !== "undefined" ? localStorage.getItem("sessionToken") : null;

  const checkSession = async () => {
    if (!token) {
      setSession(null);
      return;
    }
    try {
      const result = await validateSession({ token });
      setSession(result as { userId: string; sessionId: string } | null);
    } catch {
      setSession(null);
    }
  };

  // Check on first render
  useState(() => {
    checkSession();
  });

  return (
    <div>
      <h1>convex-zen auth</h1>
      <p style={{ color: "#64748b", marginBottom: "1.5rem" }}>
        Test app for the <code>convex-zen</code> component.
      </p>

      <div className="card">
        <h2>Session Status</h2>
        {session === "loading" ? (
          <p>Checking…</p>
        ) : session ? (
          <>
            <p>
              <span className="tag tag-green">Authenticated</span>
            </p>
            <p style={{ fontSize: "0.875rem", color: "#64748b", marginTop: "0.5rem" }}>
              User ID: <code>{session.userId}</code>
            </p>
          </>
        ) : (
          <p>
            <span className="tag tag-gray">Not signed in</span>
          </p>
        )}
        <button
          className="btn-secondary"
          style={{ marginTop: "0.75rem" }}
          onClick={checkSession}
        >
          Refresh
        </button>
      </div>

      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        <Link to="/signup">
          <button className="btn-primary">Sign Up</button>
        </Link>
        <Link to="/signin">
          <button className="btn-secondary">Sign In</button>
        </Link>
        <Link to="/dashboard">
          <button className="btn-secondary">Dashboard →</button>
        </Link>
      </div>
    </div>
  );
}
