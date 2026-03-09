import { v } from "convex/values";

/** Runtime validator for OAuth provider configuration payloads. */
export const oauthProviderConfigValidator = v.object({
  id: v.string(),
  clientId: v.string(),
  clientSecret: v.string(),
  tokenEncryptionSecret: v.optional(v.string()),
  authorizationUrl: v.string(),
  tokenUrl: v.string(),
  userInfoUrl: v.string(),
  scopes: v.array(v.string()),
  accessType: v.optional(v.union(v.literal("offline"), v.literal("online"))),
  prompt: v.optional(
    v.union(
      v.literal("none"),
      v.literal("consent"),
      v.literal("select_account")
    )
  ),
  hostedDomain: v.optional(v.string()),
});
