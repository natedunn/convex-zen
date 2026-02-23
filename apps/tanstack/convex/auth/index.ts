import { ConvexAuth } from "convex-zen";
import { adminPlugin } from "convex-zen/plugins/admin";
import { components } from "../_generated/api";

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
  requireEmailVerified: false,
  plugins: [adminPlugin({ defaultRole: "user", adminRole: "admin" })],
};

export const auth = new ConvexAuth(components.convexAuth, authOptions);
