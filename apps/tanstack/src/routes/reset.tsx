import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useConvexMutation } from "@convex-dev/react-query";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../../convex/_generated/api";

export const Route = createFileRoute("/reset")({
  component: ResetPage,
});

type Phase = "request" | "reset" | "done";

function ResetPage() {
  const requestPasswordResetMutation = useMutation({
    mutationFn: useConvexMutation(api.zen.core.requestPasswordReset),
  });
  const resetPasswordMutation = useMutation({
    mutationFn: useConvexMutation(api.zen.core.resetPassword),
  });
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [phase, setPhase] = useState<Phase>("request");
  const [status, setStatus] = useState<"idle" | "loading">("idle");

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setStatus("loading");
    try {
      await requestPasswordResetMutation.mutateAsync({ email });
      setPhase("reset");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setStatus("idle");
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setStatus("loading");
    try {
      await resetPasswordMutation.mutateAsync({ email, code, newPassword });
      setPhase("done");
    } catch (err) {
      setError((err as Error).message);
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
          <button
            className="btn-primary"
            onClick={() => void navigate({ to: "/signin" })}
          >
            Go to Sign In
          </button>
        </div>
      </div>
    );
  }

  if (phase === "reset") {
    return (
      <div className="card">
        <h2>Check your email</h2>
        <p className="muted">
          If an account exists for that email, we sent instructions.
        </p>
        <p className="muted">
          If you received a reset code, enter it below and choose a new
          password.
        </p>
        <p className="muted">
          In local dev mode, any reset code is printed in the Convex server
          logs.
        </p>

        <hr className="card-divider" />

        <form onSubmit={(e) => void handleResetPassword(e)}>
          <div className="field">
            <label>Reset code</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="XXXXXXXX"
              required
              maxLength={8}
            />
          </div>

          <div className="field">
            <label>New password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 12 characters"
              required
              minLength={12}
              autoComplete="new-password"
            />
          </div>

          {error && <p className="text-error">{error}</p>}

          <div className="actions">
            <button
              type="submit"
              className="btn-primary"
              disabled={status === "loading"}
            >
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

      <form onSubmit={(e) => void handleRequestReset(e)}>
        <div className="field">
          <label>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            autoComplete="email"
          />
        </div>

        {error && <p className="text-error">{error}</p>}

        <div className="actions">
          <button
            type="submit"
            className="btn-primary"
            disabled={status === "loading"}
          >
            {status === "loading" ? "Sending..." : "Send Reset Code"}
          </button>
        </div>
      </form>
    </div>
  );
}
