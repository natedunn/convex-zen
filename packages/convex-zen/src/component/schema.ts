import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Core identity table
  users: defineTable({
    email: v.string(),
    emailVerified: v.boolean(),
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    // Admin plugin fields (always present, only populated when admin plugin active)
    role: v.optional(v.string()),
    banned: v.optional(v.boolean()),
    banReason: v.optional(v.string()),
    banExpires: v.optional(v.number()),
  })
    .index("by_email", ["email"]),

  // One row per auth method per user
  accounts: defineTable({
    userId: v.id("users"),
    providerId: v.string(),   // "credential" | "google" | "github"
    accountId: v.string(),    // email for credential; provider user ID for OAuth
    passwordHash: v.optional(v.string()),  // Argon2id, only for credential
    accessToken: v.optional(v.string()),
    refreshToken: v.optional(v.string()),
    accessTokenExpiresAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_provider_accountId", ["providerId", "accountId"]),

  // Opaque token stored as SHA-256 hash
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

  // Email verification and password reset codes
  verifications: defineTable({
    identifier: v.string(),  // email address
    type: v.string(),        // "email-verification" | "password-reset"
    codeHash: v.string(),    // SHA-256 of 8-char alphanumeric code
    expiresAt: v.number(),
    attempts: v.number(),
    createdAt: v.number(),
  })
    .index("by_identifier_type", ["identifier", "type"]),

  // PKCE code verifier + state parameter, short-lived
  oauthStates: defineTable({
    stateHash: v.string(),
    codeVerifier: v.string(),
    provider: v.string(),
    redirectUrl: v.optional(v.string()),
    expiresAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_stateHash", ["stateHash"]),

  // Sliding window counters for brute force protection
  rateLimits: defineTable({
    key: v.string(),          // e.g. "signin:ip:1.2.3.4"
    count: v.number(),
    windowStart: v.number(),
    lockedUntil: v.optional(v.number()),
  })
    .index("by_key", ["key"]),

  // Plugin and auth configuration
  config: defineTable({
    key: v.string(),
    value: v.string(),  // JSON
  })
    .index("by_key", ["key"]),
});
