"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { StatusTag, TokenDiagnostics } from "@convex-zen/playground-ui";

type Session = {
  userId: string;
  sessionId: string;
} | null;

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

export default function Page() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [session, setSession] = useState<Session>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<ActionStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const tokenSummary = summarizeToken(token);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextSession, nextToken] = await Promise.all([
        authClient.getSession(),
        authClient.getToken(),
      ]);
      setSession(nextSession);
      setToken(nextToken);
      return nextSession;
    } catch (refreshError) {
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : "Could not refresh session"
      );
      return null;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const onSignIn = async (event: FormEvent<HTMLFormElement>) => {
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
            <p className="session-detail">
              Session ID: <code>{session.sessionId}</code>
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
        <form onSubmit={onSignIn}>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
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
              onChange={(event) => setPassword(event.target.value)}
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
              onClick={onSignOut}
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
            onClick={onLoadToken}
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
        <Link href="/signup">Create account</Link>
        <Link href="/signin">Sign in page</Link>
        <Link href="/verify">Verify email</Link>
        <Link href="/reset">Reset password</Link>
        <Link href="/dashboard">Dashboard</Link>
        <Link href="/system-admin">System Admin</Link>
      </div>
    </>
  );
}
