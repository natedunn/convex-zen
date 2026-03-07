"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export default function VerifyPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initialEmail = params.get("email");
    if (initialEmail) {
      setEmail(initialEmail);
    }
  }, []);

  const onVerify = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.trim()) {
      setError("Email is required");
      return;
    }

    setError(null);
    setStatus("loading");

    try {
      await authClient.core.verifyEmail({
        email: email.trim(),
        code,
      });
      setStatus("done");
    } catch (verifyError) {
      setError(
        verifyError instanceof Error
          ? verifyError.message
          : "Email verification failed"
      );
      setStatus("idle");
    }
  };

  if (status === "done") {
    return (
      <div className="card">
        <h2>Email verified</h2>
        <p className="muted">You can now sign in with your account.</p>
        <div className="actions">
          <button className="btn-primary" onClick={() => router.push("/signin")}>Go to Sign In</button>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <h2>Verify your email</h2>
      <p className="muted">Submit the code sent to your email address.</p>
      <p className="muted">In local dev mode, the code is printed in the Convex server logs.</p>

      <hr className="card-divider" />

      <form onSubmit={onVerify}>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            autoComplete="email"
          />
        </div>

        <div className="field">
          <label htmlFor="code">Verification code</label>
          <input
            id="code"
            type="text"
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            placeholder="XXXXXXXX"
            required
            maxLength={8}
            autoComplete="one-time-code"
          />
        </div>

        {error ? <p className="text-error">{error}</p> : null}

        <div className="actions">
          <button type="submit" className="btn-primary" disabled={status !== "idle"}>
            {status === "loading" ? "Verifying..." : "Verify Email"}
          </button>
        </div>
      </form>
    </div>
  );
}
