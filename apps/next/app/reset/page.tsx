"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

type Phase = "request" | "reset" | "done";

export default function ResetPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("request");
  const [status, setStatus] = useState<"idle" | "loading">("idle");

  const onRequestReset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setStatus("loading");
    try {
      await authClient.core.requestPasswordReset({
        email: email.trim(),
      });
      setPhase("reset");
    } catch (resetError) {
      setError(
        resetError instanceof Error
          ? resetError.message
          : "Could not request password reset"
      );
    } finally {
      setStatus("idle");
    }
  };

  const onResetPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setStatus("loading");
    try {
      await authClient.core.resetPassword({
        email: email.trim(),
        code,
        newPassword,
      });
      setPhase("done");
    } catch (resetError) {
      setError(
        resetError instanceof Error ? resetError.message : "Could not reset password"
      );
    } finally {
      setStatus("idle");
    }
  };

  if (phase === "done") {
    return (
      <div className="card">
        <h2>Password reset complete</h2>
        <p className="muted">Your password has been updated.</p>
        <div className="actions">
          <button className="btn-primary" onClick={() => router.push("/signin")}>Go to Sign In</button>
        </div>
      </div>
    );
  }

  if (phase === "reset") {
    return (
      <div className="card">
        <h2>Set a new password</h2>
        <p className="muted">
          Enter the reset code sent to <strong>{email}</strong> and choose a new
          password.
        </p>
        <p className="muted">In local dev mode, the code is printed in the Convex server logs.</p>

        <hr className="card-divider" />

        <form onSubmit={onResetPassword}>
          <div className="field">
            <label htmlFor="code">Reset code</label>
            <input
              id="code"
              type="text"
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              placeholder="XXXXXXXX"
              required
              maxLength={8}
            />
          </div>

          <div className="field">
            <label htmlFor="newPassword">New password</label>
            <input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder="At least 12 characters"
              required
              minLength={12}
              autoComplete="new-password"
            />
          </div>

          {error ? <p className="text-error">{error}</p> : null}

          <div className="actions">
            <button type="submit" className="btn-primary" disabled={status !== "idle"}>
              {status === "loading" ? "Resetting..." : "Reset Password"}
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="card">
      <h2>Forgot password</h2>
      <p className="muted">Request a reset code using your account email.</p>

      <hr className="card-divider" />

      <form onSubmit={onRequestReset}>
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

        {error ? <p className="text-error">{error}</p> : null}

        <div className="actions">
          <button type="submit" className="btn-primary" disabled={status !== "idle"}>
            {status === "loading" ? "Sending..." : "Send Reset Code"}
          </button>
        </div>
      </form>
    </div>
  );
}
