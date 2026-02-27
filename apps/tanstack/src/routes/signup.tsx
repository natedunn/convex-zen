import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useConvexMutation } from "@convex-dev/react-query";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../../convex/_generated/api";

export const Route = createFileRoute("/signup")({
  component: SignUpPage,
});

function SignUpPage() {
  const signUpMutation = useMutation({
    mutationFn: useConvexMutation(api.auth.core.signUp),
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
      <div>
        <h1>Check your email</h1>
        <p style={{ color: "#64748b" }}>
          A verification code was sent to <strong>{email}</strong>.
        </p>
        <p style={{ color: "#64748b", fontSize: "0.875rem" }}>
          💡 In dev mode, the code is printed to the Convex server console.
        </p>
        <div style={{ marginTop: "1rem", display: "flex", gap: "0.75rem" }}>
          <button
            className="btn-primary"
            onClick={() => void navigate({ to: "/verify", search: { email } })}
          >
            Enter code →
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

  return (
    <div>
      <h1>Create account</h1>
      <form onSubmit={(e) => void handleSubmit(e)}>
        <label>Name (optional)</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          autoComplete="name"
        />

        <label>Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
          autoComplete="email"
        />

        <label>Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
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
          {status === "loading" ? "Creating…" : "Create account"}
        </button>
      </form>
    </div>
  );
}
