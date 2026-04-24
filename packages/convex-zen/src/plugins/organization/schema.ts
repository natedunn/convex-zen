import { defineTable } from "convex/server";
import { v } from "convex/values";
import { definePluginSchema } from "../../client/index.js";

export const schema = definePluginSchema({
  tables: {
    organization__organizations: defineTable({
      name: v.string(),
      slug: v.string(),
      logo: v.optional(v.string()),
      createdByUserId: v.id("users"),
      createdAt: v.number(),
      updatedAt: v.number(),
    }).index("by_slug", ["slug"]),

    organization__roles: defineTable({
      organizationId: v.id("organization__organizations"),
      name: v.string(),
      slug: v.string(),
      description: v.optional(v.string()),
      permissions: v.array(v.string()),
      createdByUserId: v.id("users"),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_organizationId", ["organizationId"])
      .index("by_organizationId_slug", ["organizationId", "slug"]),

    organization__members: defineTable({
      organizationId: v.id("organization__organizations"),
      userId: v.id("users"),
      roleType: v.string(),
      systemRole: v.optional(v.string()),
      customRoleId: v.optional(v.id("organization__roles")),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_organizationId", ["organizationId"])
      .index("by_userId", ["userId"])
      .index("by_organizationId_userId", ["organizationId", "userId"]),

    organization__invitations: defineTable({
      organizationId: v.id("organization__organizations"),
      email: v.string(),
      roleType: v.string(),
      systemRole: v.optional(v.string()),
      customRoleId: v.optional(v.id("organization__roles")),
      invitedByUserId: v.id("users"),
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

    organization__domains: defineTable({
      organizationId: v.id("organization__organizations"),
      hostname: v.string(),
      verificationToken: v.string(),
      verifiedAt: v.optional(v.number()),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_hostname", ["hostname"])
      .index("by_organizationId", ["organizationId"]),
  },
});
