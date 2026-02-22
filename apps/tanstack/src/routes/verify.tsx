import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAction } from "convex/react";
import { useState } from "react";
import { api } from "../../convex/_generated/api";

export const Route = createFileRoute("/verify")({
  validateSearch: (search: Record<string, unknown>) => ({
    email: typeof search["email"] === "string" ? search["email"] : undefined,
  }),
  component: VerifyPage,
});

function VerifyPage() {
  const verifyEmail = useAction(api.functions.verifyEmail);
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
      await verifyEmail({ email, code });
      setStatus("done");
    } catch (err) {
      setError((err as Error).message);
      setStatus("idle");
    }
  };

  if (status === "done") {
    return (
      <div>
        <h1>Email verified!</h1>
        <p style={{ color: "#64748b" }}>
          Your email has been verified. You can now sign in.
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

  return (
    <div>
      <h1>Verify your email</h1>
      <p style={{ color: "#64748b" }}>
        Enter the verification code sent to{" "}
        <strong>{email ?? "your email"}</strong>.
      </p>
      <p style={{ color: "#64748b", fontSize: "0.875rem" }}>
        💡 In dev mode, the code is printed to the Convex server console.
      </p>
      <form onSubmit={(e) => void handleSubmit(e)}>
        <label>Verification code</label>
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="XXXXXXXX"
          required
          maxLength={8}
          style={{ letterSpacing: "0.2em", fontFamily: "monospace" }}
          autoComplete="one-time-code"
        />

        {error && <p className="error">{error}</p>}

        <button
          type="submit"
          className="btn-primary"
          disabled={status === "loading"}
        >
          {status === "loading" ? "Verifying…" : "Verify email"}
        </button>
      </form>
    </div>
  );
}
