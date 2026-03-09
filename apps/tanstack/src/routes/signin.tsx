import {
	createFileRoute,
	redirect,
	Link,
	useNavigate,
	useRouter,
} from "@tanstack/react-router";
import { useState } from "react";
import { authClient } from "../lib/auth-client";

type OAuthProviderId = "google" | "github" | "discord";

export const Route = createFileRoute("/signin")({
	beforeLoad: ({ context }) => {
		if (context.isAuthenticated) {
			throw redirect({ to: "/dashboard" });
		}
	},
	component: SignInPage,
});

function SignInPage() {
	const navigate = useNavigate();
	const router = useRouter();

	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
	const [status, setStatus] = useState<"idle" | "loading">("idle");

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");
		setStatus("loading");
		try {
			await authClient.signIn.email({ email, password });
			await router.invalidate();
			void navigate({ to: "/dashboard" });
		} catch (err) {
			setError((err as Error).message);
			setStatus("idle");
		}
	};

	const handleOAuthSignIn = async (providerId: OAuthProviderId) => {
		setError("");
		setStatus("loading");
		try {
			await authClient.signIn.oauth(providerId, {
				redirectTo: "/dashboard",
				errorRedirectTo: "/signin",
			});
		} catch (err) {
			setError((err as Error).message);
			setStatus("idle");
		}
	};

	return (
		<div className="card">
			<h2>Sign in</h2>
			<p className="muted">Authenticate with email/password or OAuth.</p>

			<div className="actions">
				<button
					type="button"
					className="btn-secondary"
					disabled={status === "loading"}
					onClick={() => void handleOAuthSignIn("google")}
				>
					Continue with Google
				</button>
				<button
					type="button"
					className="btn-secondary"
					disabled={status === "loading"}
					onClick={() => void handleOAuthSignIn("github")}
				>
					Continue with GitHub
				</button>
				<button
					type="button"
					className="btn-secondary"
					disabled={status === "loading"}
					onClick={() => void handleOAuthSignIn("discord")}
				>
					Continue with Discord
				</button>
			</div>

			<hr className="card-divider" />

			<form onSubmit={(e) => void handleSubmit(e)}>
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
						placeholder="Your password"
						required
						autoComplete="current-password"
					/>
				</div>

				{error && <p className="text-error">{error}</p>}

				<div className="actions">
					<button
						type="submit"
						className="btn-primary"
						disabled={status === "loading"}
					>
						{status === "loading" ? "Signing in..." : "Sign In"}
					</button>
				</div>
			</form>

			<div className="flow-links">
				<Link to="/reset">Forgot password?</Link>
				<Link to="/signup">Create account</Link>
			</div>
		</div>
	);
}
