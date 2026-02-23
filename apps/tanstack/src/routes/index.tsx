import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "convex-zen/react";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  const { status, session, refresh } = useAuth();

  return (
    <div>
      <h1>convex-zen auth</h1>
      <p style={{ color: "#64748b", marginBottom: "1.5rem" }}>
        Test app for the <code>convex-zen</code> component.
      </p>

      <div className="card">
        <h2>Session Status</h2>
        {status === "loading" ? (
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
          onClick={() => void refresh()}
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
