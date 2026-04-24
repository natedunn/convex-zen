import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useConvexMutation } from "@convex-dev/react-query";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../../convex/_generated/api";

export const Route = createFileRoute("/signup")({
  component: SignUpPage,
});

function SignUpPage() {
  const signUpMutation = useMutation({
    mutationFn: useConvexMutation(api.zen.core.signUp),
  });
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState<
    "idle" | "loading" | "verify" | "done"
  >("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setStatus("loading");
    try {
      const result = await signUpMutation.mutateAsync({
        email,
        password,
        name: name || undefined,
      });
      if ((result as { status: string }).status === "verification_required") {
        setStatus("verify");
      } else {
        setStatus("done");
      }
    } catch (err) {
      setError((err as Error).message);
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
          <button
            className="btn-primary"
            onClick={() => void navigate({ to: "/verify", search: { email } })}
          >
            Enter Verification Code
          </button>
          <button
            className="btn-secondary"
            onClick={() => void navigate({ to: "/signin" })}
          >
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
      <h2>Create account</h2>
      <p className="muted">Create a new email/password user.</p>

      <hr className="card-divider" />

      <form onSubmit={(e) => void handleSubmit(e)}>
        <div className="field">
          <label>Name (optional)</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            autoComplete="name"
          />
        </div>

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

        <div className="field">
          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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
            {status === "loading" ? "Creating..." : "Create Account"}
          </button>
        </div>
      </form>

      <div className="flow-links">
        <Link to="/signin">Already have an account?</Link>
      </div>
    </div>
  );
}
