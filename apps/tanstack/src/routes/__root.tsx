import {
	createRootRouteWithContext,
	HeadContent,
	Link,
	Outlet,
	Scripts,
	useRouteContext,
} from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { ConvexProvider } from "convex/react";
import { ConvexZenAuthProvider } from "convex-zen/react";
import { type ReactNode } from "react";
import { authClient } from "../lib/auth-client";
import type { RouterContext } from "../router";
import "@convex-zen/playground-ui/playground.css";

const getSessionServerFn = createServerFn({ method: "GET" }).handler(
	async () => {
		const { getSession } = await import("../lib/auth-server");
		return getSession();
	},
);

export const Route = createRootRouteWithContext<RouterContext>()({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "convex-zen auth playground (TanStack Start example)" },
		],
	}),
	staleTime: 0,
	preloadStaleTime: 0,
	beforeLoad: async () => {
		try {
			const session = await getSessionServerFn();
			return {
				isAuthenticated: session !== null,
				session,
			};
		} catch {
			return {
				isAuthenticated: false,
				session: null,
			};
		}
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
					<div className="app-shell">
						<header className="site-header">
							<section className="card site-hero">
								<p className="framework-badge">TANSTACK START EXAMPLE</p>
								<h1>convex-zen auth playground</h1>
								<p className="muted">
									Internal contributor test harness for{" "}
									<code>convex-zen/tanstack-start</code>.
								</p>
								<nav className="site-nav">
									<Link to="/">Home</Link>
									<Link to="/signup">Sign Up</Link>
									<Link to="/signin">Sign In</Link>
									<Link to="/reset">Reset Password</Link>
									<Link to="/dashboard">Dashboard</Link>
									<Link to="/admin">Admin</Link>
								</nav>
							</section>
						</header>
						<main className="site-main">
							<Outlet />
						</main>
					</div>
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
			<h2>Page not found</h2>
			<p className="muted">The page you requested does not exist.</p>
			<Link to="/">Return home</Link>
		</section>
	);
}
