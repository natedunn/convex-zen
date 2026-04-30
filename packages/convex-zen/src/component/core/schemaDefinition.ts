import { defineTable } from "convex/server";
import { v } from "convex/values";

export const coreSchemaTables = {
  users: defineTable({
    email: v.string(),
    emailVerified: v.boolean(),
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_email", ["email"]),

  accounts: defineTable({
    userId: v.id("users"),
    providerId: v.string(),
    accountId: v.string(),
    passwordHash: v.optional(v.string()),
    accessToken: v.optional(v.string()),
    refreshToken: v.optional(v.string()),
    accessTokenExpiresAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_provider_accountId", ["providerId", "accountId"]),

  sessions: defineTable({
    userId: v.id("users"),
    tokenHash: v.string(),
    expiresAt: v.number(),
    absoluteExpiresAt: v.number(),
    lastActiveAt: v.number(),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_tokenHash", ["tokenHash"])
    .index("by_userId", ["userId"])
    .index("by_expiresAt", ["expiresAt"]),

  verifications: defineTable({
    identifier: v.string(),
    type: v.string(),
    codeHash: v.string(),
    expiresAt: v.number(),
    attempts: v.number(),
    createdAt: v.number(),
  }).index("by_identifier_type", ["identifier", "type"]),

  oauthStates: defineTable({
    stateHash: v.string(),
    codeVerifier: v.string(),
    provider: v.string(),
    returnTarget: v.optional(v.string()),
    proxyMode: v.optional(v.union(v.literal("direct"), v.literal("broker"))),
    redirectUrl: v.optional(v.string()),
    callbackUrl: v.optional(v.string()),
    redirectTo: v.optional(v.string()),
    errorRedirectTo: v.optional(v.string()),
    expiresAt: v.number(),
    createdAt: v.number(),
  }).index("by_stateHash", ["stateHash"]),

  oauthProxyHandoffs: defineTable({
    codeHash: v.string(),
    userId: v.id("users"),
    provider: v.string(),
    redirectTo: v.optional(v.string()),
    errorRedirectTo: v.optional(v.string()),
    expiresAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_codeHash", ["codeHash"])
    .index("by_expiresAt", ["expiresAt"]),

  rateLimits: defineTable({
    key: v.string(),
    count: v.number(),
    windowStart: v.number(),
    lockedUntil: v.optional(v.number()),
  }).index("by_key", ["key"]),

  config: defineTable({
    key: v.string(),
    value: v.string(),
  }).index("by_key", ["key"]),
};
