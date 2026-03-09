import {
	ConvexZen,
	discordProvider,
	githubProvider,
	googleProvider,
} from "convex-zen";
import { adminPlugin } from "convex-zen/plugins/admin";
import { components } from "./_generated/api";

/**
 * Source of truth for auth setup used by the generator.
 */
export const authOptions = {
	emailProvider: {
		sendVerificationEmail: async (to: string, code: string) => {
			console.log(`\n📧 Verification email → ${to}\n   Code: ${code}\n`);
		},
		sendPasswordResetEmail: async (to: string, code: string) => {
			console.log(`\n🔑 Password reset email → ${to}\n   Code: ${code}\n`);
		},
	},
	providers: [
		discordProvider({
			clientId: process.env["DISCORD_CLIENT_ID"]!,
			clientSecret: process.env["DISCORD_CLIENT_SECRET"]!,
		}),
		githubProvider({
			clientId: process.env["GITHUB_CLIENT_ID"]!,
			clientSecret: process.env["GITHUB_CLIENT_SECRET"]!,
		}),
		googleProvider({
			clientId: process.env["GOOGLE_CLIENT_ID"]!,
			clientSecret: process.env["GOOGLE_CLIENT_SECRET"]!,
		}),
	],
	requireEmailVerified: true,
	plugins: [adminPlugin({ defaultRole: "user", adminRole: "admin" })],
};

export const auth = new ConvexZen(components.convexAuth, authOptions);
