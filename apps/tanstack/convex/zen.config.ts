import { defineConvexZen, githubProvider } from "convex-zen";
import { examplePlugin } from "convex-zen-example";
import { systemAdminPlugin } from "convex-zen/plugins/system-admin";
import { organizationPlugin } from "convex-zen/plugins/organization";

const githubClientId = process.env.GITHUB_CLIENT_ID;
const githubClientSecret = process.env.GITHUB_CLIENT_SECRET;

export default defineConvexZen({
	oauthProxy: {
		allowedReturnTargets: [
			{ type: "webUrl", url: "http://tanstack.localhost:1355" },
			{ type: "webUrlPattern", pattern: "http://*.tanstack.localhost:1355" },
		],
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
	emailPassword: {
		onSuppressedEvent: async (event) => {
			console.log("Suppressed email/password event", {
				flow: event.flow,
				reason: event.reason,
			});
		},
		sendVerification: async (to: string) => {
			console.log(`Verification email requested for ${to}`);
		},
		sendPasswordReset: async (to: string) => {
			console.log(`Password reset email requested for ${to}`);
		},
		requireVerification: true,
	},
	runtime: {
		tokenEncryptionSecretEnvVar: "CONVEX_ZEN_SECRET",
	},
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
