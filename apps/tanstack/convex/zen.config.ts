import { defineConvexZen, githubProvider } from "convex-zen";
import { systemAdminPlugin } from "convex-zen/plugins/system-admin";
import { examplePlugin } from "convex-zen-example";
import { organizationPlugin } from "convex-zen/plugins/organization";

const githubClientId = process.env.GITHUB_CLIENT_ID;
const githubClientSecret = process.env.GITHUB_CLIENT_SECRET;

export default defineConvexZen({
	onSuppressedEmailPasswordEvent: async (ctx) => {
		console.log(`Suppressed email/password event: `, ctx);
	},
	emailProvider: {
		sendVerificationEmail: async (to: string, code: string) => {
			console.log(`Verification email to ${to}: ${code}`);
		},
		sendPasswordResetEmail: async (to: string, code: string) => {
			console.log(`Password reset email to ${to}: ${code}`);
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
