"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "checking">("checking");

  useEffect(() => {
    let cancelled = false;

    const checkSession = async () => {
      try {
        const session = await authClient.getSession();
        if (!cancelled && session) {
          router.replace("/dashboard");
          return;
        }
      } catch {
        // Ignore session probe errors and keep sign-in page usable.
      }
      if (!cancelled) {
        setStatus("idle");
      }
    };

    void checkSession();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const onSignIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setStatus("loading");
    try {
      await authClient.signIn.email({ email, password });
      router.replace("/dashboard");
    } catch (signInError) {
      setError(
        signInError instanceof Error ? signInError.message : "Sign in failed"
      );
      setStatus("idle");
    }
  };

  return (
    <div className="card">
      <h2>Sign in</h2>
      <p className="muted">Authenticate with email and password.</p>

      <hr className="card-divider" />

      <form onSubmit={onSignIn}>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            required
            autoComplete="email"
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
            required
            autoComplete="current-password"
          />
        </div>

        {error ? <p className="text-error">{error}</p> : null}

        <div className="actions">
          <button type="submit" className="btn-primary" disabled={status !== "idle"}>
            {status === "checking"
              ? "Checking session..."
              : status === "loading"
                ? "Signing in..."
                : "Sign In"}
          </button>
        </div>
      </form>

      <div className="flow-links">
        <Link href="/reset">Forgot password?</Link>
        <Link href="/signup">Create account</Link>
      </div>
    </div>
  );
}
