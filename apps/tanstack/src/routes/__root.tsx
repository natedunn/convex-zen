import {
	createRootRouteWithContext,
	HeadContent,
	Link,
	Outlet,
	Scripts,
	useRouteContext,
} from "@tanstack/react-router";
import { ConvexProvider } from "convex/react";
import { ConvexZenAuthProvider } from "convex-zen/react";
import type { ReactNode } from "react";
import { authClient, getSession } from "../lib/auth-client";
import type { RouterContext } from "../router";

export const Route = createRootRouteWithContext<RouterContext>()({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "convex-zen auth — test app" },
		],
		links: [{ rel: "stylesheet", href: "/styles.css" }],
	}),
	beforeLoad: async () => {
		const session = await getSession();
		return {
			isAuthenticated: session !== null,
			session,
		};
	},
	component: RootComponent,
	notFoundComponent: NotFoundComponent,
});

function RootComponent() {
	const context = useRouteContext({ from: Route.id });

	return (
		<RootDocument>
			<ConvexZenAuthProvider
				client={authClient}
				initialSession={context.session}
			>
				<ConvexProvider client={context.convex}>
					<nav style={navStyle}>
						<Link to="/" style={linkStyle}>
							Home
						</Link>
						<Link to="/signup" style={linkStyle}>
							Sign Up
						</Link>
						<Link to="/signin" style={linkStyle}>
							Sign In
						</Link>
						<Link to="/dashboard" style={linkStyle}>
							Dashboard
						</Link>
						<Link to="/admin" style={linkStyle}>
							Admin
						</Link>
					</nav>
					<main style={mainStyle}>
						<Outlet />
					</main>
				</ConvexProvider>
			</ConvexZenAuthProvider>
		</RootDocument>
	);
}

function RootDocument({ children }: { children: ReactNode }) {
	return (
		<html lang="en">
			<head>
				<HeadContent />
				<style>{css}</style>
			</head>
			<body>
				{children}
				<Scripts />
			</body>
		</html>
	);
}

function NotFoundComponent() {
	return (
		<section className="card">
			<h1>Page not found</h1>
			<p style={{ marginBottom: "1rem" }}>
				The page you requested does not exist.
			</p>
			<Link to="/" style={linkStyle}>
				Return home
			</Link>
		</section>
	);
}

const navStyle: React.CSSProperties = {
	display: "flex",
	gap: "1rem",
	padding: "1rem 2rem",
	borderBottom: "1px solid #e2e8f0",
	background: "#f8fafc",
};

const linkStyle: React.CSSProperties = {
	textDecoration: "none",
	color: "#4f46e5",
	fontWeight: 500,
};

const mainStyle: React.CSSProperties = {
	maxWidth: "480px",
	margin: "2rem auto",
	padding: "0 1rem",
};

const css = `
  * { box-sizing: border-box; }
  body { font-family: system-ui, sans-serif; margin: 0; color: #1e293b; }
  h1 { font-size: 1.5rem; font-weight: 700; margin-bottom: 1rem; }
  h2 { font-size: 1.25rem; font-weight: 600; margin-bottom: 0.75rem; }
  label { display: block; margin-bottom: 0.25rem; font-size: 0.875rem; color: #475569; }
  input {
    display: block; width: 100%; padding: 0.5rem 0.75rem;
    border: 1px solid #cbd5e1; border-radius: 0.375rem;
    font-size: 1rem; margin-bottom: 0.75rem;
  }
  input:focus { outline: 2px solid #4f46e5; border-color: transparent; }
  button {
    padding: 0.5rem 1.25rem; border-radius: 0.375rem; border: none;
    cursor: pointer; font-size: 0.9375rem; font-weight: 500;
  }
  .btn-primary { background: #4f46e5; color: white; }
  .btn-primary:hover { background: #4338ca; }
  .btn-danger { background: #dc2626; color: white; }
  .btn-secondary { background: #e2e8f0; color: #1e293b; }
  .error { color: #dc2626; font-size: 0.875rem; margin-top: 0.5rem; }
  .success { color: #16a34a; font-size: 0.875rem; margin-top: 0.5rem; }
  .card {
    background: #f8fafc; border: 1px solid #e2e8f0;
    border-radius: 0.5rem; padding: 1rem; margin-bottom: 1rem;
  }
  .tag {
    display: inline-block; padding: 0.125rem 0.5rem;
    border-radius: 9999px; font-size: 0.75rem; font-weight: 600;
  }
  .tag-green { background: #dcfce7; color: #166534; }
  .tag-red { background: #fee2e2; color: #991b1b; }
  .tag-gray { background: #f1f5f9; color: #475569; }
  a[data-active] { font-weight: 700; text-decoration: underline; }
`;
