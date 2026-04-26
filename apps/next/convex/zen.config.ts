import { createConvexZenClient, defineConvexZen, discordProvider, githubProvider, googleProvider } from "convex-zen";
import { systemAdminPlugin } from "convex-zen/plugins/system-admin";
import { organizationPlugin } from "convex-zen/plugins/organization";

function readRequiredOAuthEnv(
	key: "DISCORD_CLIENT_ID" | "DISCORD_CLIENT_SECRET" | "GITHUB_CLIENT_ID" | "GITHUB_CLIENT_SECRET" | "GOOGLE_CLIENT_ID" | "GOOGLE_CLIENT_SECRET"
): string | null {
	const value = process.env[key]?.trim();
	return value && value.length > 0 ? value : null;
}

const discordClientId = readRequiredOAuthEnv("DISCORD_CLIENT_ID");
const discordClientSecret = readRequiredOAuthEnv("DISCORD_CLIENT_SECRET");
const githubClientId = readRequiredOAuthEnv("GITHUB_CLIENT_ID");
const githubClientSecret = readRequiredOAuthEnv("GITHUB_CLIENT_SECRET");
const googleClientId = readRequiredOAuthEnv("GOOGLE_CLIENT_ID");
const googleClientSecret = readRequiredOAuthEnv("GOOGLE_CLIENT_SECRET");

const providers = [
	discordClientId && discordClientSecret
		? discordProvider({
				clientId: discordClientId,
				clientSecret: discordClientSecret,
		  })
		: null,
	githubClientId && githubClientSecret
		? githubProvider({
				clientId: githubClientId,
				clientSecret: githubClientSecret,
		  })
		: null,
	googleClientId && googleClientSecret
		? googleProvider({
				clientId: googleClientId,
				clientSecret: googleClientSecret,
		  })
		: null,
].filter((provider) => provider !== null);

const zenConfig = defineConvexZen({
	providers,
	emailPassword: {
		sendVerification: async (to: string, code: string) => {
			console.log(`\n📧 Verification email → ${to}\n   Code: ${code}\n`);
		},
		sendPasswordReset: async (to: string, code: string) => {
			console.log(`\n🔑 Password reset email → ${to}\n   Code: ${code}\n`);
		},
		requireVerification: true,
	},
	runtime: {
		tokenEncryptionSecretEnvVar: "CONVEX_ZEN_SECRET",
	},
	plugins: [
		systemAdminPlugin({ defaultRole: "user", adminRole: "admin" }),
		organizationPlugin({
			accessControl: {
				billing: ["read"],
			},
			roles: {
				owner: {
					billing: ["read"],
				},
				admin: {
					billing: ["read"],
				},
			},
			subdomainSuffix: "example.com",
		}),
	],
});

export default zenConfig;

export function createAuth(component: Record<string, unknown>) {
	return createConvexZenClient(component, zenConfig);
}
