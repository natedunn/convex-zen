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
    mutationFn: useConvexMutation(api.auth.core.requestPasswordReset),
  });
  const resetPasswordMutation = useMutation({
    mutationFn: useConvexMutation(api.auth.core.resetPassword),
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
      <div>
        <h1>Password reset!</h1>
        <p style={{ color: "#64748b" }}>
          Your password has been updated. You can now sign in.
        </p>
        <div style={{ marginTop: "1rem" }}>
          <button
            className="btn-primary"
            onClick={() => void navigate({ to: "/signin" })}
          >
            Sign In →
          </button>
        </div>
      </div>
    );
  }

  if (phase === "reset") {
    return (
      <div>
        <h1>Reset password</h1>
        <p style={{ color: "#64748b" }}>
          Enter the reset code sent to <strong>{email}</strong> and choose a
          new password.
        </p>
        <p style={{ color: "#64748b", fontSize: "0.875rem" }}>
          💡 In dev mode, the code is printed to the Convex server console.
        </p>
        <form onSubmit={(e) => void handleResetPassword(e)}>
          <label>Reset code</label>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="XXXXXXXX"
            required
            maxLength={8}
            style={{ letterSpacing: "0.2em", fontFamily: "monospace" }}
          />

          <label>New password</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="At least 8 characters"
            required
            minLength={8}
            autoComplete="new-password"
          />

          {error && <p className="error">{error}</p>}

          <button
            type="submit"
            className="btn-primary"
            disabled={status === "loading"}
          >
            {status === "loading" ? "Resetting…" : "Reset password"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div>
      <h1>Forgot password</h1>
      <p style={{ color: "#64748b" }}>
        Enter your email and we'll send you a reset code.
      </p>
      <form onSubmit={(e) => void handleRequestReset(e)}>
        <label>Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
          autoComplete="email"
        />

        {error && <p className="error">{error}</p>}

        <button
          type="submit"
          className="btn-primary"
          disabled={status === "loading"}
        >
          {status === "loading" ? "Sending…" : "Send reset code"}
        </button>
      </form>
    </div>
  );
}
