"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

type SignUpResult = {
  status?: string;
};

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "verify" | "done">(
    "idle"
  );

  const onSignUp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setStatus("loading");
    try {
      const result = (await authClient.core.signUp({
        email,
        password,
        name: name.trim() ? name.trim() : undefined,
      })) as SignUpResult;

      if (result.status === "verification_required") {
        setStatus("verify");
        return;
      }

      setStatus("done");
    } catch (signUpError) {
      setError(
        signUpError instanceof Error ? signUpError.message : "Sign up failed"
      );
      setStatus("idle");
    }
  };

  if (status === "verify") {
    return (
      <div className="card">
        <h2>Check your email</h2>
        <p className="muted">
          If this email can be used, check your inbox for next steps.
        </p>
        <p className="muted">
          In local dev mode, any verification code is printed in the Convex
          server logs.
        </p>
        <div className="actions">
          <button className="btn-primary" onClick={() => router.push(`/verify?email=${encodeURIComponent(email)}`)}>
            Enter Verification Code
          </button>
          <button className="btn-secondary" onClick={() => router.push("/signin")}>
            Sign In
          </button>
        </div>
      </div>
    );
  }

  if (status === "done") {
    return (
      <div className="card">
        <h2>Account created</h2>
        <p className="muted">Your account is ready. Continue to sign in.</p>
        <div className="actions">
          <button className="btn-primary" onClick={() => router.push("/signin")}>Go to Sign In</button>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <h2>Create account</h2>
      <p className="muted">Create a new email/password user.</p>

      <hr className="card-divider" />

      <form onSubmit={onSignUp}>
        <div className="field">
          <label htmlFor="name">Name (optional)</label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Your name"
            autoComplete="name"
          />
        </div>

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
            placeholder="At least 12 characters"
            required
            minLength={12}
            autoComplete="new-password"
          />
        </div>

        {error ? <p className="text-error">{error}</p> : null}

        <div className="actions">
          <button type="submit" className="btn-primary" disabled={status !== "idle"}>
            {status === "loading" ? "Creating..." : "Create Account"}
          </button>
        </div>
      </form>

      <div className="flow-links">
        <Link href="/signin">Already have an account?</Link>
      </div>
    </div>
  );
}
