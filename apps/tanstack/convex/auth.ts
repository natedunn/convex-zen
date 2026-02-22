import { ConvexAuth } from "convex-zen";
import { adminPlugin } from "convex-zen/plugins/admin";
import { components } from "./_generated/api";

/**
 * Auth instance for the test app.
 *
 * Email provider prints codes to the server console so you can
 * use them during local development without a real email service.
 *
 * To enable OAuth, set CONVEX_GOOGLE_CLIENT_ID / CONVEX_GITHUB_CLIENT_ID
 * env vars in your Convex dashboard.
 */
export const auth = new ConvexAuth(components.convexAuth, {
  emailProvider: {
    sendVerificationEmail: async (to, code) => {
      console.log(`\n📧 Verification email → ${to}\n   Code: ${code}\n`);
    },
    sendPasswordResetEmail: async (to, code) => {
      console.log(`\n🔑 Password reset email → ${to}\n   Code: ${code}\n`);
    },
  },
  plugins: [adminPlugin({ defaultRole: "user", adminRole: "admin" })],
  requireEmailVerified: false, // relaxed for local testing
});
