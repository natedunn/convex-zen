import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAction } from "convex/react";
import { useState } from "react";
import { api } from "../../convex/_generated/api";

export const Route = createFileRoute("/signin")({
  component: SignInPage,
});

function SignInPage() {
  const signIn = useAction(api.functions.signIn);
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState<"idle" | "loading">("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setStatus("loading");
    try {
      const result = await signIn({ email, password });
      const { sessionToken } = result as { sessionToken: string };
      localStorage.setItem("sessionToken", sessionToken);
      void navigate({ to: "/dashboard" });
    } catch (err) {
      setError((err as Error).message);
      setStatus("idle");
    }
  };

  return (
    <div>
      <h1>Sign in</h1>
      <form onSubmit={(e) => void handleSubmit(e)}>
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
          placeholder="Your password"
          required
          autoComplete="current-password"
        />

        {error && <p className="error">{error}</p>}

        <button
          type="submit"
          className="btn-primary"
          disabled={status === "loading"}
        >
          {status === "loading" ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p style={{ marginTop: "1rem", fontSize: "0.875rem", color: "#64748b" }}>
        Forgot your password?{" "}
        <a
          href="/reset"
          style={{ color: "#4f46e5" }}
          onClick={(e) => {
            e.preventDefault();
            void navigate({ to: "/reset" });
          }}
        >
          Reset it
        </a>
      </p>
    </div>
  );
}
