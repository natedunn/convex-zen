import Link from "next/link";
import { isAuthenticated } from "@/lib/auth-server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
	if (!(await isAuthenticated("/dashboard"))) {
		redirect("/");
	}

	return (
		<main>
			<section className="panel">
				<h1>Protected Dashboard</h1>
					<p>Access granted. Authenticated cookie session detected.</p>
				<p>
					<Link href="/">Back to auth playground</Link>
				</p>
			</section>
		</main>
	);
}
