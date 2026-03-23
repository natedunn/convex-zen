import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  organizations: defineTable({
    name: v.string(),
    slug: v.string(),
    logo: v.optional(v.string()),
    createdByUserId: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_slug", ["slug"]),

  organizationRoles: defineTable({
    organizationId: v.id("organizations"),
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    permissions: v.array(v.string()),
    createdByUserId: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_organizationId", ["organizationId"])
    .index("by_organizationId_slug", ["organizationId", "slug"]),

  organizationMembers: defineTable({
    organizationId: v.id("organizations"),
    userId: v.string(),
    roleType: v.string(),
    systemRole: v.optional(v.string()),
    customRoleId: v.optional(v.id("organizationRoles")),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_organizationId", ["organizationId"])
    .index("by_userId", ["userId"])
    .index("by_organizationId_userId", ["organizationId", "userId"]),

  organizationInvitations: defineTable({
    organizationId: v.id("organizations"),
    email: v.string(),
    roleType: v.string(),
    systemRole: v.optional(v.string()),
    customRoleId: v.optional(v.id("organizationRoles")),
    invitedByUserId: v.string(),
    tokenHash: v.string(),
    expiresAt: v.number(),
    acceptedAt: v.optional(v.number()),
    cancelledAt: v.optional(v.number()),
    declinedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_tokenHash", ["tokenHash"])
    .index("by_organizationId", ["organizationId"])
    .index("by_organizationId_email", ["organizationId", "email"])
    .index("by_email", ["email"]),

  organizationDomains: defineTable({
    organizationId: v.id("organizations"),
    hostname: v.string(),
    verificationToken: v.string(),
    verifiedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_hostname", ["hostname"])
    .index("by_organizationId", ["organizationId"]),
});
