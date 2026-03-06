"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";

type Session = {
  userId: string;
  sessionId: string;
} | null;

function summarizeToken(token: string | null) {
  if (!token) {
    return {
      present: false,
      length: 0,
      preview: null as string | null,
    };
  }

  const preview =
    token.length > 40
      ? `${token.slice(0, 20)}...${token.slice(-16)}`
      : token;

  return {
    present: true,
    length: token.length,
    preview,
  };
}

export default function Page() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [session, setSession] = useState<Session>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
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
    try {
      await authClient.signIn.email({ email, password });
      await refresh();
    } catch (signInError) {
      setError(
        signInError instanceof Error ? signInError.message : "Sign in failed"
      );
    }
  };

  const onSignOut = async () => {
    setError(null);
    try {
      await authClient.signOut();
      setToken(null);
      await refresh();
    } catch (signOutError) {
      setError(
        signOutError instanceof Error ? signOutError.message : "Sign out failed"
      );
    }
  };

  const onLoadToken = async () => {
    setError(null);
    try {
      const nextToken = await authClient.getToken({ forceRefresh: true });
      setToken(nextToken);
    } catch (tokenError) {
      setError(
        tokenError instanceof Error ? tokenError.message : "Could not load token"
      );
    }
  };

  return (
    <main>
      <section className="panel">
        <h1>Next.js Auth Playground</h1>
        <p>
          This page uses <code>convex-zen/next</code> with Convex-backed auth routes.
        </p>
        <p>
          <Link href="/dashboard">Go to protected dashboard</Link>
        </p>

        <form onSubmit={onSignIn}>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          <div className="actions">
            <button type="submit">Sign In</button>
            <button type="button" className="secondary" onClick={onSignOut}>
              Sign Out
            </button>
            <button type="button" className="secondary" onClick={onLoadToken}>
              Load Token
            </button>
            <button type="button" className="secondary" onClick={() => void refresh()}>
              Refresh Session
            </button>
          </div>
        </form>

        {error ? <p className="error">{error}</p> : null}

        {tokenSummary.present ? (
          <p>
            Token loaded. Length: <strong>{tokenSummary.length}</strong>
          </p>
        ) : (
          <p>Token not loaded yet.</p>
        )}

        <pre>
          {JSON.stringify(
            {
              loading,
              session,
              token: tokenSummary,
            },
            null,
            2
          )}
        </pre>

        {tokenSummary.present ? (
          <details>
            <summary>Show full token</summary>
            <pre>{token}</pre>
          </details>
        ) : null}
      </section>
    </main>
  );
}
