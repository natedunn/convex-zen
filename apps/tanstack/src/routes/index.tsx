import { createFileRoute, Link } from "@tanstack/react-router";
import { useSession } from "convex-zen/react";
import { useState } from "react";
import { authClient } from "../lib/auth-client";
import { StatusTag, TokenDiagnostics } from "@convex-zen/playground-ui";

export const Route = createFileRoute("/")({
  component: HomePage,
});

type ActionStatus = "idle" | "signingIn" | "signingOut" | "loadingToken";

function summarizeToken(token: string | null) {
  if (!token) {
    return { present: false, length: 0, preview: null as string | null };
  }
  const preview =
    token.length > 40
      ? `${token.slice(0, 20)}...${token.slice(-16)}`
      : token;
  return { present: true, length: token.length, preview };
}

function HomePage() {
  const { status: sessionStatus, session, refresh } = useSession();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<ActionStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const tokenSummary = summarizeToken(token);
  const loading = sessionStatus === "loading";

  const onSignIn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setStatus("signingIn");
    try {
      await authClient.signIn.email({ email, password });
      await refresh();
    } catch (signInError) {
      setError(
        signInError instanceof Error ? signInError.message : "Sign in failed"
      );
    } finally {
      setStatus("idle");
    }
  };

  const onSignOut = async () => {
    setError(null);
    setStatus("signingOut");
    try {
      await authClient.signOut();
      setToken(null);
      await refresh();
    } catch (signOutError) {
      setError(
        signOutError instanceof Error ? signOutError.message : "Sign out failed"
      );
    } finally {
      setStatus("idle");
    }
  };

  const onLoadToken = async () => {
    setError(null);
    setStatus("loadingToken");
    try {
      const nextToken = await authClient.getToken({ forceRefresh: true });
      setToken(nextToken);
    } catch (tokenError) {
      setError(
        tokenError instanceof Error ? tokenError.message : "Could not load token"
      );
    } finally {
      setStatus("idle");
    }
  };

  const isBusy = loading || status !== "idle";

  return (
    <>
      <div className="card">
        <p className="section-label">Session status</p>
        {loading ? (
          <p className="loading-text">Checking session...</p>
        ) : session ? (
          <>
            <p>
              <StatusTag variant="success">Authenticated</StatusTag>
            </p>
            <p className="session-detail">
              User ID: <code>{session.userId}</code>
            </p>
          </>
        ) : (
          <p>
            <StatusTag variant="neutral">Not signed in</StatusTag>
          </p>
        )}
      </div>

      <div className="card">
        <p className="section-label">Quick sign in</p>
        <form onSubmit={(e) => void onSignIn(e)}>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
              autoComplete="current-password"
              required
            />
          </div>
          <div className="actions">
            <button type="submit" className="btn-primary" disabled={isBusy}>
              {status === "signingIn" ? "Signing in..." : "Sign In"}
            </button>
            <button
              type="button"
              className="btn-danger"
              disabled={isBusy || !session}
              onClick={() => void onSignOut()}
            >
              {status === "signingOut" ? "Signing out..." : "Sign Out"}
            </button>
          </div>
        </form>
        {error ? <p className="text-error">{error}</p> : null}
      </div>

      <div className="card">
        <p className="section-label">Token controls</p>
        <div className="actions">
          <button
            type="button"
            className="btn-secondary"
            disabled={isBusy}
            onClick={() => void onLoadToken()}
          >
            {status === "loadingToken" ? "Loading..." : "Load Token"}
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={loading}
            onClick={() => void refresh()}
          >
            Refresh Session
          </button>
        </div>
        <TokenDiagnostics
          loading={loading}
          status={status}
          session={session}
          tokenSummary={tokenSummary}
          fullToken={token}
        />
      </div>

      <div className="flow-links">
        <Link to="/signup">Create account</Link>
        <Link to="/signin">Sign in page</Link>
        <Link to="/verify" search={{ email: undefined }}>
          Verify email
        </Link>
        <Link to="/reset">Reset password</Link>
        <Link to="/dashboard">Dashboard</Link>
        <Link to="/system-admin">System Admin</Link>
      </div>
    </>
  );
}
