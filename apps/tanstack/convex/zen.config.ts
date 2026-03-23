import { defineConvexZen, githubProvider } from "convex-zen";
import { adminPlugin } from "convex-zen-admin";
import { examplePlugin } from "convex-zen-example";
import { organizationPlugin } from "convex-zen-organization";

const githubClientId = process.env.GITHUB_CLIENT_ID;
const githubClientSecret = process.env.GITHUB_CLIENT_SECRET;

export default defineConvexZen({
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
		adminPlugin({ defaultRole: "user", adminRole: "admin" }),
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
