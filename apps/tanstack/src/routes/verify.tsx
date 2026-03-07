import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useConvexMutation } from "@convex-dev/react-query";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../../convex/_generated/api";

export const Route = createFileRoute("/verify")({
  validateSearch: (search: Record<string, unknown>) => ({
    email: typeof search["email"] === "string" ? search["email"] : undefined,
  }),
  component: VerifyPage,
});

function VerifyPage() {
  const verifyEmailMutation = useMutation({
    mutationFn: useConvexMutation(api.auth.core.verifyEmail),
  });
  const navigate = useNavigate();
  const { email } = Route.useSearch();

  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError("No email address found. Please sign up again.");
      return;
    }
    setError("");
    setStatus("loading");
    try {
      await verifyEmailMutation.mutateAsync({ email, code });
      setStatus("done");
    } catch (err) {
      setError((err as Error).message);
      setStatus("idle");
    }
  };

  if (status === "done") {
    return (
      <div className="card">
        <h2>Email verified</h2>
        <p className="muted">You can now sign in with your account.</p>
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

  return (
    <div className="card">
      <h2>Verify your email</h2>
      <p className="muted">
        Submit the code sent to <strong>{email ?? "your email"}</strong>.
      </p>
      <p className="muted">
        In local dev mode, the code is printed in the Convex server logs.
      </p>

      <hr className="card-divider" />

      <form onSubmit={(e) => void handleSubmit(e)}>
        <div className="field">
          <label>Verification code</label>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="XXXXXXXX"
            required
            maxLength={8}
            autoComplete="one-time-code"
          />
        </div>

        {error && <p className="text-error">{error}</p>}

        <div className="actions">
          <button
            type="submit"
            className="btn-primary"
            disabled={status === "loading"}
          >
            {status === "loading" ? "Verifying..." : "Verify Email"}
          </button>
        </div>
      </form>
    </div>
  );
}
