# Organizations Plugin

The `organization` plugin adds workspace-style membership on top of `convex-zen`'s global user identity model.

## Setup

Enable the plugin in `convex/zen.config.ts`:

```ts
import { ConvexZen } from "convex-zen";
import { organizationPlugin } from "convex-zen-organization";
import { components } from "./_generated/api";

export const auth = new ConvexZen(components.convexAuth, {
  plugins: [
    organizationPlugin({
      accessControl: {
        billing: ["read"],
        project: ["write"],
      },
      roles: {
        owner: {
          billing: ["read"],
          project: ["write"],
        },
        admin: {
          billing: ["read"],
          project: ["write"],
        },
      },
      subdomainSuffix: "example.com",
    }),
  ],
});
```

Then regenerate wrappers:

```bash
npx convex-zen generate
```

This adds `convex/zen/plugin/organization.ts` and updates `convex/zen/_generated/meta.ts`.

## What v1 includes

- Organizations with slugs and optional logos
- Reserved system roles: `owner`, `admin`, `member`
- Dynamic custom roles stored per organization
- Invitations with accept/cancel/expiry handling
- Domain records plus DNS verification challenge helpers
- Host-to-organization resolution via verified custom domains or `slug.<subdomainSuffix>`

## Auth model

- Users remain global
- Sessions remain user-scoped
- The current organization is app-resolved, not session-bound
- `accessControl` defines the allowed permission vocabulary in code
- Organization admins can create custom org roles at runtime using those permissions

Use the URL, subdomain, custom domain, or an explicit `organizationId` to decide which org the user is operating in.

## Domain and custom-domain notes

Subdomains like `acme.example.com` can share auth cookies when your framework sets the cookie domain to `.example.com`.

Custom domains like `portal.acme.com` and `dashboard.contoso.com` cannot share cookies with each other. For those deployments:

- Use a central auth callback domain
- Redirect back with a short-lived handoff token
- Issue a first-party session cookie on the destination domain

The organizations plugin does not implement that handoff for you. It only stores verified domain mappings and helps resolve `host -> organization`.

## Common APIs

From the `ConvexZen` auth object:

```ts
await auth.organization.createOrganization(ctx, {
  name: "Acme",
  slug: "acme",
});

await auth.organization.inviteMember(ctx, {
  organizationId,
  email: "teammate@example.com",
  role: {
    type: "system",
    systemRole: "member",
  },
});

const billingAdminRole = await auth.organization.createRole(ctx, {
  organizationId,
  name: "Billing Admin",
  slug: "billing-admin",
  permissions: ["billing:read"],
});

await auth.organization.setMemberRole(ctx, {
  organizationId,
  userId,
  role: {
    type: "custom",
    customRoleId: billingAdminRole._id,
  },
});

const canWrite = await auth.organization.hasPermission(ctx, {
  organizationId,
  permission: {
    resource: "project",
    action: "write",
  },
});
```

Generated plugin routes are also exposed through `authClient.plugin.organization.*` when you use the Next or TanStack adapters with generated metadata.
