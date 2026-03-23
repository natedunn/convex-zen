import type { Metadata } from "next";
import Link from "next/link";
import { AppAuthProvider } from "./auth-provider";
import { getSession } from "@/lib/auth-server";
import "./globals.css";

export const metadata: Metadata = {
	title: "convex-zen auth playground (Next.js example)",
	description: "Internal integration harness for convex-zen/next",
};

export default async function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	const initialSession = await getSession().catch(() => null);

	return (
		<html lang="en">
			<body>
				<AppAuthProvider initialSession={initialSession}>
					<div className="app-shell">
						<header className="site-header">
							<section className="card site-hero">
								<p className="framework-badge">NEXT.JS EXAMPLE</p>
								<h1>convex-zen auth playground</h1>
								<p className="muted">
									Internal contributor test harness for{" "}
									<code>convex-zen/next</code>.
								</p>
								<nav className="site-nav">
									<Link href="/">Home</Link>
									<Link href="/signup">Sign Up</Link>
									<Link href="/signin">Sign In</Link>
									<Link href="/reset">Reset Password</Link>
									<Link href="/dashboard">Dashboard</Link>
									<Link href="/system-admin">System Admin</Link>
								</nav>
							</section>
						</header>
						<main className="site-main">{children}</main>
					</div>
				</AppAuthProvider>
			</body>
		</html>
	);
}
