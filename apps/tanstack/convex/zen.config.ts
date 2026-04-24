import { defineConvexZen, githubProvider } from "convex-zen";
import { examplePlugin } from "convex-zen-example";
import { organizationPlugin, systemAdminPlugin } from "convex-zen/plugins";

const githubClientId = process.env.GITHUB_CLIENT_ID;
const githubClientSecret = process.env.GITHUB_CLIENT_SECRET;

export default defineConvexZen({
	onSuppressedEmailPasswordEvent: async (event) => {
		console.log("Suppressed email/password event", {
			flow: event.flow,
			reason: event.reason,
		});
	},
	emailProvider: {
		sendVerificationEmail: async (to: string) => {
			console.log(`Verification email requested for ${to}`);
		},
		sendPasswordResetEmail: async (to: string) => {
			console.log(`Password reset email requested for ${to}`);
		},
	},
	providers:
		githubClientId && githubClientSecret
			? [
					githubProvider({
						clientId: githubClientId,
						clientSecret: githubClientSecret,
					}),
				]
			: [],
	requireEmailVerified: true,
	plugins: [
		examplePlugin({
			defaultScope: "tanstack-playground",
		}),
		systemAdminPlugin({ defaultRole: "user", adminRole: "admin" }),
		organizationPlugin({
			accessControl: {
				project: ["write"],
			},
			roles: {
				admin: {
					project: ["write"],
				},
			},
		}),
	],
});
