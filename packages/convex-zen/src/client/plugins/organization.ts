import {
  defineAuthPlugin,
  BuiltInOrganizationAccessControl,
  Organization,
  OrganizationAccessControl,
  OrganizationAvailablePermissionsResult,
  OrganizationCustomAccessControl,
  OrganizationCustomRoleDefinitions,
  OrganizationDomain,
  OrganizationDomainVerificationChallenge,
  OrganizationIncomingInvitation,
  OrganizationInvitation,
  OrganizationInviteResult,
  OrganizationListResult,
  OrganizationMember,
  OrganizationMembership,
  OrganizationPermission,
  OrganizationPluginConfig,
  OrganizationRoleName,
  OrganizationRoleAssignmentInput,
  OrganizationRoleDefinitions,
  OrganizationRoleListResult,
  OrganizationRoleRecord,
  OrganizationSlugCheckResult,
} from "../../types";
import { resolveComponentFn } from "../helpers";

/**
 * Organization plugin client module.
 *
 * This file owns organization-specific runtime logic and the config-derived
 * helper types that describe `auth.plugins.organization`.
 * The main client entrypoint should only extract the organization config from
 * the app's plugin tuple and delegate the rest here.
 */

const DEFAULT_INVITE_EXPIRES_MS = 7 * 24 * 60 * 60 * 1000;
const BUILT_IN_ACCESS_CONTROL = {
  organization: ["read", "update", "delete", "transfer"],
  accessControl: ["read"],
  role: ["read", "create", "update", "delete"],
  member: ["read", "create", "update", "delete"],
  invitation: ["read", "create", "cancel", "accept"],
  domain: ["read", "create", "verify", "delete"],
} as const satisfies BuiltInOrganizationAccessControl;

const DEFAULT_ROLE_DEFINITIONS = {
  owner: {
    organization: ["read", "update", "delete", "transfer"],
    accessControl: ["read"],
    role: ["read", "create", "update", "delete"],
    member: ["read", "create", "update", "delete"],
    invitation: ["read", "create", "cancel", "accept"],
    domain: ["read", "create", "verify", "delete"],
  },
  admin: {
    organization: ["read", "update"],
    accessControl: ["read"],
    role: ["read", "create", "update"],
    member: ["read", "create", "update", "delete"],
    invitation: ["read", "create", "cancel"],
    domain: ["read", "create"],
  },
  member: {
    organization: ["read"],
    member: ["read"],
  },
} as const;

type RunsQueries = {
  runQuery(fn: unknown, args: Record<string, unknown>): Promise<unknown>;
};

type RunsMutations = {
  runMutation(fn: unknown, args: Record<string, unknown>): Promise<unknown>;
};

type RuntimeRolePermissions = Record<string, string[]>;

function permissionToken(resource: string, action: string): string {
  return `${resource}:${action}`;
}

function cloneAccessControl<
  TCustomAccessControl extends OrganizationCustomAccessControl,
>(
  accessControl: OrganizationAccessControl<TCustomAccessControl>
): OrganizationAccessControl<TCustomAccessControl> {
  return Object.fromEntries(
    Object.entries(accessControl).map(([resource, actions]) => [
      resource,
      [...actions],
    ])
  ) as unknown as OrganizationAccessControl<TCustomAccessControl>;
}

function resolveAccessControl<
  TCustomAccessControl extends OrganizationCustomAccessControl,
>(
  customAccessControl: TCustomAccessControl | undefined
): OrganizationAccessControl<TCustomAccessControl> {
  return {
    ...cloneAccessControl(BUILT_IN_ACCESS_CONTROL),
    ...(customAccessControl ?? {}),
  } as unknown as OrganizationAccessControl<TCustomAccessControl>;
}

function resolveRoleDefinitions<
  TAccessControl extends Record<string, readonly string[]>,
  TCustomRoles extends OrganizationCustomRoleDefinitions<TAccessControl>,
>(
  accessControl: TAccessControl,
  roleDefinitions: OrganizationRoleDefinitions<TAccessControl, TCustomRoles> | undefined
): OrganizationRoleDefinitions<TAccessControl, TCustomRoles> {
  const resolved = structuredClone(DEFAULT_ROLE_DEFINITIONS) as Record<
    string,
    Record<string, readonly string[]>
  >;

  if (roleDefinitions) {
    for (const [role, resourceDefinitions] of Object.entries(roleDefinitions)) {
      const existing = resolved[role] ?? {};
      resolved[role] = {
        ...existing,
        ...resourceDefinitions,
      };
    }
  }

  for (const [role, resourceDefinitions] of Object.entries(resolved)) {
    for (const [resource, actions] of Object.entries(resourceDefinitions)) {
      if (!(resource in accessControl)) {
        throw new Error(`Unknown organization access-control resource: ${resource}`);
      }
      const allowedActions = new Set(accessControl[resource] ?? []);
      for (const action of actions) {
        if (!allowedActions.has(action)) {
          throw new Error(
            `Unknown organization action "${action}" for resource "${resource}"`
          );
        }
      }
    }
    if (Object.keys(resourceDefinitions).length === 0) {
      delete resolved[role];
    }
  }

  return resolved as OrganizationRoleDefinitions<TAccessControl, TCustomRoles>;
}

function flattenRolePermissions(
  roleDefinitions: Record<string, Record<string, readonly string[]>>
): RuntimeRolePermissions {
  const flattened: RuntimeRolePermissions = {};
  for (const [role, resourceDefinitions] of Object.entries(roleDefinitions)) {
    const permissions = new Set<string>();
    for (const [resource, actions] of Object.entries(resourceDefinitions)) {
      for (const action of actions) {
        permissions.add(permissionToken(resource, action));
      }
    }
    flattened[role] = [...permissions].sort();
  }
  return flattened;
}

const ORGANIZATION_PLUGIN_PREAMBLE = `const organizationPermissionValidator = v.object({
  resource: v.string(),
  action: v.string(),
});

const organizationRoleAssignmentValidator = v.union(
  v.object({
    type: v.literal("system"),
    systemRole: v.string(),
  }),
  v.object({
    type: v.literal("custom"),
    customRoleId: v.string(),
  }),
);`;

export const organizationPlugin = defineAuthPlugin<
  "organization",
  OrganizationPluginConfig<any, any>,
  OrganizationPlugin<any, any>
>({
  id: "organization",
  component: {
    importPath: "convex-zen/plugins/organization/convex.config",
    childName: "organizationComponent",
  },
  normalizeOptions: (
    config?: OrganizationPluginConfig<any, any>
  ): OrganizationPluginConfig<any, any> =>
    ({
      allowUserOrganizationCreation:
        config?.allowUserOrganizationCreation !== false,
      inviteExpiresInMs:
        config?.inviteExpiresInMs ?? DEFAULT_INVITE_EXPIRES_MS,
      ...(config?.subdomainSuffix !== undefined
        ? { subdomainSuffix: config.subdomainSuffix }
        : {}),
      ...(config?.accessControl !== undefined
        ? { accessControl: config.accessControl }
        : {}),
      ...(config?.roles !== undefined ? { roles: config.roles } : {}),
    }),
  createClientRuntime: ({ component, childName, options, runtimeKind }) =>
    new OrganizationPlugin(
      component,
      options as OrganizationPluginConfig<any, any>,
      childName,
      runtimeKind
    ),
  publicFunctions: {
    preambleSource: ORGANIZATION_PLUGIN_PREAMBLE,
    functions: {
      checkSlug: {
        kind: "query",
        auth: "public",
        runtimeMethod: "checkSlug",
        componentPath: "organization/gateway:checkSlug",
        argsSource: "{\n    slug: v.string(),\n  }",
      },
      createOrganization: {
        kind: "mutation",
        auth: "actor",
        runtimeMethod: "createOrganization",
        componentPath: "organization/gateway:createOrganization",
        argsSource:
          "{\n    name: v.string(),\n    slug: v.string(),\n    logo: v.optional(v.string()),\n  }",
      },
      updateOrganization: {
        kind: "mutation",
        auth: "actor",
        runtimeMethod: "updateOrganization",
        componentPath: "organization/gateway:updateOrganization",
        argsSource:
          "{\n    organizationId: v.string(),\n    name: v.optional(v.string()),\n    slug: v.optional(v.string()),\n    logo: v.optional(v.string()),\n  }",
      },
      deleteOrganization: {
        kind: "mutation",
        auth: "actor",
        runtimeMethod: "deleteOrganization",
        componentPath: "organization/gateway:deleteOrganization",
        argsSource: "{\n    organizationId: v.string(),\n  }",
      },
      listOrganizations: {
        kind: "query",
        auth: "actor",
        runtimeMethod: "listOrganizations",
        componentPath: "organization/gateway:listOrganizations",
        argsSource: "{}",
      },
      getOrganization: {
        kind: "query",
        auth: "actor",
        runtimeMethod: "getOrganization",
        componentPath: "organization/gateway:getOrganization",
        argsSource: "{\n    organizationId: v.string(),\n  }",
      },
      getMembership: {
        kind: "query",
        auth: "actor",
        runtimeMethod: "getMembership",
        componentPath: "organization/gateway:getMembership",
        argsSource: "{\n    organizationId: v.string(),\n  }",
      },
      listMembers: {
        kind: "query",
        auth: "actor",
        runtimeMethod: "listMembers",
        componentPath: "organization/gateway:listMembers",
        argsSource: "{\n    organizationId: v.string(),\n  }",
      },
      inviteMember: {
        kind: "mutation",
        auth: "actor",
        runtimeMethod: "inviteMember",
        componentPath: "organization/gateway:inviteMember",
        argsSource:
          "{\n    organizationId: v.string(),\n    email: v.string(),\n    role: organizationRoleAssignmentValidator,\n  }",
        castType: "InviteMemberArgs",
      },
      listInvitations: {
        kind: "query",
        auth: "actor",
        runtimeMethod: "listInvitations",
        componentPath: "organization/gateway:listInvitations",
        argsSource: "{\n    organizationId: v.string(),\n  }",
      },
      listIncomingInvitations: {
        kind: "query",
        auth: "actor",
        runtimeMethod: "listIncomingInvitations",
        componentPath: "organization/gateway:listIncomingInvitations",
        argsSource: "{}",
      },
      acceptInvitation: {
        kind: "mutation",
        auth: "actor",
        runtimeMethod: "acceptInvitation",
        componentPath: "organization/gateway:acceptInvitation",
        argsSource: "{\n    token: v.string(),\n  }",
      },
      acceptIncomingInvitation: {
        kind: "mutation",
        auth: "actor",
        runtimeMethod: "acceptIncomingInvitation",
        componentPath: "organization/gateway:acceptIncomingInvitation",
        argsSource: "{\n    invitationId: v.string(),\n  }",
      },
      cancelInvitation: {
        kind: "mutation",
        auth: "actor",
        runtimeMethod: "cancelInvitation",
        componentPath: "organization/gateway:cancelInvitation",
        argsSource: "{\n    invitationId: v.string(),\n  }",
      },
      declineIncomingInvitation: {
        kind: "mutation",
        auth: "actor",
        runtimeMethod: "declineIncomingInvitation",
        componentPath: "organization/gateway:declineIncomingInvitation",
        argsSource: "{\n    invitationId: v.string(),\n  }",
      },
      removeMember: {
        kind: "mutation",
        auth: "actor",
        runtimeMethod: "removeMember",
        componentPath: "organization/gateway:removeMember",
        argsSource: "{\n    organizationId: v.string(),\n    userId: v.string(),\n  }",
      },
      setMemberRole: {
        kind: "mutation",
        auth: "actor",
        runtimeMethod: "setMemberRole",
        componentPath: "organization/gateway:setMemberRole",
        argsSource:
          "{\n    organizationId: v.string(),\n    userId: v.string(),\n    role: organizationRoleAssignmentValidator,\n  }",
        castType: "SetMemberRoleArgs",
      },
      transferOwnership: {
        kind: "mutation",
        auth: "actor",
        runtimeMethod: "transferOwnership",
        componentPath: "organization/gateway:transferOwnership",
        argsSource:
          "{\n    organizationId: v.string(),\n    newOwnerUserId: v.string(),\n  }",
      },
      createRole: {
        kind: "mutation",
        auth: "actor",
        runtimeMethod: "createRole",
        componentPath: "organization/gateway:createRole",
        argsSource:
          "{\n    organizationId: v.string(),\n    name: v.string(),\n    slug: v.string(),\n    description: v.optional(v.string()),\n    permissions: v.array(v.string()),\n  }",
      },
      listRoles: {
        kind: "query",
        auth: "actor",
        runtimeMethod: "listRoles",
        componentPath: "organization/gateway:listRoles",
        argsSource: "{\n    organizationId: v.string(),\n  }",
      },
      listAvailablePermissions: {
        kind: "query",
        auth: "actor",
        runtimeMethod: "listAvailablePermissions",
        componentPath: "organization/gateway:listAvailablePermissions",
        argsSource: "{\n    organizationId: v.string(),\n  }",
      },
      getRole: {
        kind: "query",
        auth: "actor",
        runtimeMethod: "getRole",
        componentPath: "organization/gateway:getRole",
        argsSource: "{\n    roleId: v.string(),\n  }",
      },
      updateRole: {
        kind: "mutation",
        auth: "actor",
        runtimeMethod: "updateRole",
        componentPath: "organization/gateway:updateRole",
        argsSource:
          "{\n    roleId: v.string(),\n    name: v.optional(v.string()),\n    slug: v.optional(v.string()),\n    description: v.optional(v.string()),\n    permissions: v.optional(v.array(v.string())),\n  }",
      },
      deleteRole: {
        kind: "mutation",
        auth: "actor",
        runtimeMethod: "deleteRole",
        componentPath: "organization/gateway:deleteRole",
        argsSource: "{\n    roleId: v.string(),\n  }",
      },
      addDomain: {
        kind: "mutation",
        auth: "actor",
        runtimeMethod: "addDomain",
        componentPath: "organization/gateway:addDomain",
        argsSource:
          "{\n    organizationId: v.string(),\n    hostname: v.string(),\n  }",
      },
      listDomains: {
        kind: "query",
        auth: "actor",
        runtimeMethod: "listDomains",
        componentPath: "organization/gateway:listDomains",
        argsSource: "{\n    organizationId: v.string(),\n  }",
      },
      getDomainVerificationChallenge: {
        kind: "query",
        auth: "actor",
        runtimeMethod: "getDomainVerificationChallenge",
        componentPath: "organization/gateway:getDomainVerificationChallenge",
        argsSource: "{\n    domainId: v.string(),\n  }",
      },
      markDomainVerified: {
        kind: "mutation",
        auth: "actor",
        runtimeMethod: "markDomainVerified",
        componentPath: "organization/gateway:markDomainVerified",
        argsSource: "{\n    domainId: v.string(),\n  }",
      },
      removeDomain: {
        kind: "mutation",
        auth: "actor",
        runtimeMethod: "removeDomain",
        componentPath: "organization/gateway:removeDomain",
        argsSource: "{\n    domainId: v.string(),\n  }",
      },
      resolveOrganizationByHost: {
        kind: "query",
        auth: "public",
        runtimeMethod: "resolveOrganizationByHost",
        componentPath: "organization/gateway:resolveOrganizationByHost",
        argsSource: "{\n    host: v.string(),\n  }",
      },
      hasRole: {
        kind: "query",
        auth: "actor",
        runtimeMethod: "hasRole",
        componentPath: "organization/gateway:hasRole",
        argsSource:
          "{\n    organizationId: v.string(),\n    role: v.optional(v.string()),\n    roles: v.optional(v.array(v.string())),\n  }",
        castType: "HasRoleArgs",
      },
      requireRole: {
        kind: "query",
        auth: "actor",
        runtimeMethod: "requireRole",
        componentPath: "organization/gateway:requireRole",
        argsSource:
          "{\n    organizationId: v.string(),\n    role: v.optional(v.string()),\n    roles: v.optional(v.array(v.string())),\n  }",
        castType: "RequireRoleArgs",
      },
      hasPermission: {
        kind: "query",
        auth: "actor",
        runtimeMethod: "hasPermission",
        componentPath: "organization/gateway:hasPermission",
        argsSource:
          "{\n    organizationId: v.string(),\n    permission: organizationPermissionValidator,\n  }",
        castType: "HasPermissionArgs",
      },
      requirePermission: {
        kind: "query",
        auth: "actor",
        runtimeMethod: "requirePermission",
        componentPath: "organization/gateway:requirePermission",
        argsSource:
          "{\n    organizationId: v.string(),\n    permission: organizationPermissionValidator,\n  }",
        castType: "RequirePermissionArgs",
      },
    },
  },
  hooks: {
    onUserDeleted: true,
  },
});

/** Shared config-to-type transforms used by `ConvexZen` and this module. */
export type OrganizationAccessControlFromConfig<TConfig> =
  TConfig extends OrganizationPluginConfig<infer TCustomAccessControl, any>
    ? OrganizationAccessControl<TCustomAccessControl>
    : BuiltInOrganizationAccessControl;

export type OrganizationCustomRolesFromConfig<TConfig> =
  TConfig extends OrganizationPluginConfig<any, infer TCustomRoles>
    ? TCustomRoles
    : {};

export type OrganizationRoleFromConfig<TConfig> = OrganizationRoleName<
  OrganizationCustomRolesFromConfig<TConfig>
>;

export type OrganizationPermissionFromConfig<TConfig> = OrganizationPermission<
  OrganizationAccessControlFromConfig<TConfig>
>;

export type OrganizationPluginFromConfig<TConfig> = [TConfig] extends [never]
  ? null
  : OrganizationPlugin<
      TConfig extends OrganizationPluginConfig<infer TCustomAccessControl, any>
        ? TCustomAccessControl
        : {},
      TConfig extends OrganizationPluginConfig<any, infer TCustomRoles>
        ? OrganizationCustomRolesFromConfig<TConfig>
        : OrganizationCustomRoleDefinitions<
            OrganizationAccessControlFromConfig<TConfig>
          >
    >;

/**
 * Raw plugin API.
 *
 * These methods mirror the underlying organization gateway fairly closely and
 * generally expect an explicit `actorUserId` when authorization depends on it.
 */
export class OrganizationPlugin<
  TCustomAccessControl extends OrganizationCustomAccessControl = {},
  TCustomRoles extends OrganizationCustomRoleDefinitions<
    OrganizationAccessControl<TCustomAccessControl>
  > = {},
> {
  constructor(
    private readonly componentApi: Record<string, unknown>,
    private readonly config: OrganizationPluginConfig<TCustomAccessControl, TCustomRoles>,
    private readonly childName: string = "organization",
    private readonly runtimeKind: "app" | "component" = "app"
  ) {}

  private resolvePath(path: string): string {
    if (this.runtimeKind === "app") {
      return path;
    }
    return path.startsWith("organization/")
      ? `${this.childName}${path.slice("organization".length)}`
      : path;
  }

  private fn(path: string): unknown {
    return resolveComponentFn(this.componentApi, this.resolvePath(path));
  }

  private async runGatewayMutation(
    ctx: RunsMutations,
    path: string,
    args: Record<string, unknown>
  ): Promise<unknown> {
    return ctx.runMutation(this.fn(path), args);
  }

  private async runGatewayQuery(
    ctx: RunsQueries,
    path: string,
    args: Record<string, unknown>
  ): Promise<unknown> {
    return ctx.runQuery(this.fn(path), args);
  }

  private resolveAllowUserOrganizationCreation(): boolean {
    return this.config.allowUserOrganizationCreation !== false;
  }

  private resolveInviteExpiresInMs(): number {
    return this.config.inviteExpiresInMs ?? DEFAULT_INVITE_EXPIRES_MS;
  }

  private resolveSubdomainSuffix(): string | undefined {
    const trimmed = this.config.subdomainSuffix?.trim();
    return trimmed && trimmed.length > 0 ? trimmed : undefined;
  }

  private resolveAccessControl(): OrganizationAccessControl<TCustomAccessControl> {
    return resolveAccessControl(this.config.accessControl);
  }

  private resolveRoleDefinitions(): OrganizationRoleDefinitions<
    OrganizationAccessControl<TCustomAccessControl>,
    TCustomRoles
  > {
    return resolveRoleDefinitions(this.resolveAccessControl(), this.config.roles);
  }

  private resolveRolePermissions(): RuntimeRolePermissions {
    return flattenRolePermissions(
      this.resolveRoleDefinitions() as Record<string, Record<string, readonly string[]>>
    );
  }

  private permissionPayload<
    TPermission extends OrganizationPermission<OrganizationAccessControl<TCustomAccessControl>>,
  >(permission: TPermission): { resource: string; action: string } {
    return {
      resource: permission.resource,
      action: permission.action,
    };
  }

  private withAllowUserOrganizationCreation<T extends Record<string, unknown>>(
    args: T
  ): T | (T & { allowUserOrganizationCreation: boolean }) {
    if (this.runtimeKind === "app") {
      return args;
    }
    return {
      ...args,
      allowUserOrganizationCreation: this.resolveAllowUserOrganizationCreation(),
    };
  }

  private withRolePermissions<T extends Record<string, unknown>>(
    args: T
  ): T | (T & { rolePermissions: RuntimeRolePermissions }) {
    if (this.runtimeKind === "app") {
      return args;
    }
    return {
      ...args,
      rolePermissions: this.resolveRolePermissions(),
    };
  }

  private withAccessControlAndRolePermissions<T extends Record<string, unknown>>(
    args: T
  ): T | (T & {
    accessControl: OrganizationAccessControl<TCustomAccessControl>;
    rolePermissions: RuntimeRolePermissions;
  }) {
    if (this.runtimeKind === "app") {
      return args;
    }
    return {
      ...args,
      accessControl: this.resolveAccessControl(),
      rolePermissions: this.resolveRolePermissions(),
    };
  }

  private withInviteContext<T extends Record<string, unknown>>(
    args: T
  ): T | (T & {
    inviteExpiresInMs: number;
    accessControl: OrganizationAccessControl<TCustomAccessControl>;
    rolePermissions: RuntimeRolePermissions;
  }) {
    if (this.runtimeKind === "app") {
      return args;
    }
    return {
      ...args,
      inviteExpiresInMs: this.resolveInviteExpiresInMs(),
      accessControl: this.resolveAccessControl(),
      rolePermissions: this.resolveRolePermissions(),
    };
  }

  private withSubdomainSuffix<T extends Record<string, unknown>>(
    args: T
  ): T | (T & { subdomainSuffix?: string }) {
    if (this.runtimeKind === "app") {
      return args;
    }
    return {
      ...args,
      subdomainSuffix: this.resolveSubdomainSuffix(),
    };
  }

  async checkSlug(
    ctx: RunsQueries,
    args: { slug: string }
  ): Promise<OrganizationSlugCheckResult> {
    return this.runGatewayQuery(ctx, "organization/gateway:checkSlug", args) as Promise<OrganizationSlugCheckResult>;
  }

  async createOrganization(
    ctx: RunsMutations,
    args: {
      actorUserId: string;
      name: string;
      slug: string;
      logo?: string;
    }
  ): Promise<{ organization: Organization; membership: OrganizationMembership }> {
    return this.runGatewayMutation(
      ctx,
      "organization/gateway:createOrganization",
      this.withAllowUserOrganizationCreation(args)
    ) as Promise<{ organization: Organization; membership: OrganizationMembership }>;
  }

  async updateOrganization(
    ctx: RunsMutations,
    args: {
      actorUserId: string;
      organizationId: string;
      name?: string;
      slug?: string;
      logo?: string;
    }
  ): Promise<Organization> {
    return this.runGatewayMutation(
      ctx,
      "organization/gateway:updateOrganization",
      this.withRolePermissions(args)
    ) as Promise<Organization>;
  }

  async deleteOrganization(
    ctx: RunsMutations,
    args: { actorUserId: string; organizationId: string }
  ): Promise<void> {
    return this.runGatewayMutation(
      ctx,
      "organization/gateway:deleteOrganization",
      this.withRolePermissions(args)
    ) as Promise<void>;
  }

  async listOrganizations(
    ctx: RunsQueries,
    args: { actorUserId: string }
  ): Promise<OrganizationListResult> {
    return this.runGatewayQuery(ctx, "organization/gateway:listOrganizations", args) as Promise<OrganizationListResult>;
  }

  async getOrganization(
    ctx: RunsQueries,
    args: { actorUserId: string; organizationId: string }
  ): Promise<Organization | null> {
    return this.runGatewayQuery(
      ctx,
      "organization/gateway:getOrganization",
      this.withRolePermissions(args)
    ) as Promise<Organization | null>;
  }

  async getMembership(
    ctx: RunsQueries,
    args: { actorUserId: string; organizationId: string }
  ): Promise<OrganizationMembership | null> {
    return this.runGatewayQuery(ctx, "organization/gateway:getMembership", args) as Promise<OrganizationMembership | null>;
  }

  async listMembers(
    ctx: RunsQueries,
    args: { actorUserId: string; organizationId: string }
  ): Promise<OrganizationMember[]> {
    return this.runGatewayQuery(
      ctx,
      "organization/gateway:listMembers",
      this.withRolePermissions(args)
    ) as Promise<OrganizationMember[]>;
  }

  async inviteMember(
    ctx: RunsMutations,
    args: {
      actorUserId: string;
      organizationId: string;
      email: string;
      role: OrganizationRoleAssignmentInput;
    }
  ): Promise<{ invitation: OrganizationInvitation; token: string }> {
    return this.runGatewayMutation(
      ctx,
      "organization/gateway:inviteMember",
      this.withInviteContext(args)
    ) as Promise<{ invitation: OrganizationInvitation; token: string }>;
  }

  async listInvitations(
    ctx: RunsQueries,
    args: { actorUserId: string; organizationId: string }
  ): Promise<OrganizationInvitation[]> {
    return this.runGatewayQuery(
      ctx,
      "organization/gateway:listInvitations",
      this.withRolePermissions(args)
    ) as Promise<OrganizationInvitation[]>;
  }

  async listIncomingInvitations(
    ctx: RunsQueries,
    args: { actorUserId: string }
  ): Promise<OrganizationIncomingInvitation[]> {
    const path = "organization/gateway:listIncomingInvitations";
    return this.runGatewayQuery(ctx, path, args) as Promise<OrganizationIncomingInvitation[]>;
  }

  async acceptInvitation(
    ctx: RunsMutations,
    args: { actorUserId: string; token: string }
  ): Promise<OrganizationInvitation> {
    const path = "organization/gateway:acceptInvitation";
    return this.runGatewayMutation(ctx, path, {
      ...args,
      rolePermissions: this.resolveRolePermissions(),
    }) as Promise<OrganizationInvitation>;
  }

  async acceptIncomingInvitation(
    ctx: RunsMutations,
    args: { actorUserId: string; invitationId: string }
  ): Promise<OrganizationInvitation> {
    const path = "organization/gateway:acceptIncomingInvitation";
    return this.runGatewayMutation(ctx, path, args) as Promise<OrganizationInvitation>;
  }

  async cancelInvitation(
    ctx: RunsMutations,
    args: { actorUserId: string; invitationId: string }
  ): Promise<OrganizationInvitation> {
    return this.runGatewayMutation(
      ctx,
      "organization/gateway:cancelInvitation",
      this.withRolePermissions(args)
    ) as Promise<OrganizationInvitation>;
  }

  async declineIncomingInvitation(
    ctx: RunsMutations,
    args: { actorUserId: string; invitationId: string }
  ): Promise<OrganizationInvitation> {
    const path = "organization/gateway:declineIncomingInvitation";
    return this.runGatewayMutation(ctx, path, args) as Promise<OrganizationInvitation>;
  }

  async removeMember(
    ctx: RunsMutations,
    args: { actorUserId: string; organizationId: string; userId: string }
  ): Promise<void> {
    return this.runGatewayMutation(
      ctx,
      "organization/gateway:removeMember",
      this.withRolePermissions(args)
    ) as Promise<void>;
  }

  async setMemberRole(
    ctx: RunsMutations,
    args: {
      actorUserId: string;
      organizationId: string;
      userId: string;
      role: OrganizationRoleAssignmentInput;
    }
  ): Promise<OrganizationMembership> {
    return this.runGatewayMutation(
      ctx,
      "organization/gateway:setMemberRole",
      this.withRolePermissions(args)
    ) as Promise<OrganizationMembership>;
  }

  async transferOwnership(
    ctx: RunsMutations,
    args: {
      actorUserId: string;
      organizationId: string;
      newOwnerUserId: string;
    }
  ): Promise<void> {
    return this.runGatewayMutation(
      ctx,
      "organization/gateway:transferOwnership",
      this.withRolePermissions(args)
    ) as Promise<void>;
  }

  async createRole(
    ctx: RunsMutations,
    args: {
      actorUserId: string;
      organizationId: string;
      name: string;
      slug: string;
      description?: string;
      permissions: string[];
    }
  ): Promise<OrganizationRoleRecord> {
    return this.runGatewayMutation(
      ctx,
      "organization/gateway:createRole",
      this.withAccessControlAndRolePermissions(args)
    ) as Promise<OrganizationRoleRecord>;
  }

  async listRoles(
    ctx: RunsQueries,
    args: { actorUserId: string; organizationId: string }
  ): Promise<OrganizationRoleListResult> {
    return this.runGatewayQuery(
      ctx,
      "organization/gateway:listRoles",
      this.withRolePermissions(args)
    ) as Promise<OrganizationRoleListResult>;
  }

  async listAvailablePermissions(
    ctx: RunsQueries,
    args: { actorUserId: string; organizationId: string }
  ): Promise<OrganizationAvailablePermissionsResult> {
    return this.runGatewayQuery(
      ctx,
      "organization/gateway:listAvailablePermissions",
      this.withAccessControlAndRolePermissions(args)
    ) as Promise<OrganizationAvailablePermissionsResult>;
  }

  async getRole(
    ctx: RunsQueries,
    args: { actorUserId: string; roleId: string }
  ): Promise<OrganizationRoleRecord | null> {
    return this.runGatewayQuery(
      ctx,
      "organization/gateway:getRole",
      this.withRolePermissions(args)
    ) as Promise<OrganizationRoleRecord | null>;
  }

  async updateRole(
    ctx: RunsMutations,
    args: {
      actorUserId: string;
      roleId: string;
      name?: string;
      slug?: string;
      description?: string;
      permissions?: string[];
    }
  ): Promise<OrganizationRoleRecord> {
    return this.runGatewayMutation(
      ctx,
      "organization/gateway:updateRole",
      this.withAccessControlAndRolePermissions(args)
    ) as Promise<OrganizationRoleRecord>;
  }

  async deleteRole(
    ctx: RunsMutations,
    args: { actorUserId: string; roleId: string }
  ): Promise<void> {
    return this.runGatewayMutation(
      ctx,
      "organization/gateway:deleteRole",
      this.withRolePermissions(args)
    ) as Promise<void>;
  }

  async addDomain(
    ctx: RunsMutations,
    args: { actorUserId: string; organizationId: string; hostname: string }
  ): Promise<OrganizationDomain> {
    return this.runGatewayMutation(
      ctx,
      "organization/gateway:addDomain",
      this.withRolePermissions(args)
    ) as Promise<OrganizationDomain>;
  }

  async listDomains(
    ctx: RunsQueries,
    args: { actorUserId: string; organizationId: string }
  ): Promise<OrganizationDomain[]> {
    return this.runGatewayQuery(
      ctx,
      "organization/gateway:listDomains",
      this.withRolePermissions(args)
    ) as Promise<OrganizationDomain[]>;
  }

  async getDomainVerificationChallenge(
    ctx: RunsQueries,
    args: { actorUserId: string; domainId: string }
  ): Promise<OrganizationDomainVerificationChallenge> {
    return this.runGatewayQuery(
      ctx,
      "organization/gateway:getDomainVerificationChallenge",
      this.withRolePermissions(args)
    ) as Promise<OrganizationDomainVerificationChallenge>;
  }

  async markDomainVerified(
    ctx: RunsMutations,
    args: { actorUserId: string; domainId: string }
  ): Promise<OrganizationDomain> {
    return this.runGatewayMutation(
      ctx,
      "organization/gateway:markDomainVerified",
      this.withRolePermissions(args)
    ) as Promise<OrganizationDomain>;
  }

  async removeDomain(
    ctx: RunsMutations,
    args: { actorUserId: string; domainId: string }
  ): Promise<void> {
    return this.runGatewayMutation(
      ctx,
      "organization/gateway:removeDomain",
      this.withRolePermissions(args)
    ) as Promise<void>;
  }

  async resolveOrganizationByHost(
    ctx: RunsQueries,
    args: { host: string }
  ): Promise<Organization | null> {
    return this.runGatewayQuery(
      ctx,
      "organization/gateway:resolveOrganizationByHost",
      this.withSubdomainSuffix({ host: args.host })
    ) as Promise<Organization | null>;
  }

  async hasRole(
    ctx: RunsQueries,
    args: {
      actorUserId: string;
      organizationId: string;
      role?: OrganizationRoleName<TCustomRoles>;
      roles?: readonly OrganizationRoleName<TCustomRoles>[];
    }
  ): Promise<boolean> {
    return this.runGatewayQuery(ctx, "organization/gateway:hasRole", args) as Promise<boolean>;
  }

  async requireRole(
    ctx: RunsQueries,
    args: {
      actorUserId: string;
      organizationId: string;
      role?: OrganizationRoleName<TCustomRoles>;
      roles?: readonly OrganizationRoleName<TCustomRoles>[];
    }
  ): Promise<OrganizationMembership> {
    return this.runGatewayQuery(ctx, "organization/gateway:requireRole", args) as Promise<OrganizationMembership>;
  }

  async hasPermission(
    ctx: RunsQueries,
    args: {
      actorUserId: string;
      organizationId: string;
      permission: OrganizationPermission<OrganizationAccessControl<TCustomAccessControl>>;
    }
  ): Promise<boolean> {
    return this.runGatewayQuery(ctx, "organization/gateway:hasPermission", {
      actorUserId: args.actorUserId,
      organizationId: args.organizationId,
      permission: this.permissionPayload(args.permission),
      ...(this.runtimeKind === "component"
        ? { rolePermissions: this.resolveRolePermissions() }
        : {}),
    }) as Promise<boolean>;
  }

  async requirePermission(
    ctx: RunsQueries,
    args: {
      actorUserId: string;
      organizationId: string;
      permission: OrganizationPermission<OrganizationAccessControl<TCustomAccessControl>>;
    }
  ): Promise<OrganizationMembership> {
    return this.runGatewayQuery(ctx, "organization/gateway:requirePermission", {
      actorUserId: args.actorUserId,
      organizationId: args.organizationId,
      permission: this.permissionPayload(args.permission),
      ...(this.runtimeKind === "component"
        ? { rolePermissions: this.resolveRolePermissions() }
        : {}),
    }) as Promise<OrganizationMembership>;
  }

  get accessControl() {
    return this.resolveAccessControl();
  }

  get roles() {
    return this.resolveRoleDefinitions();
  }

  get rolePermissions() {
    return this.resolveRolePermissions();
  }

  get allowUserOrganizationCreation() {
    return this.resolveAllowUserOrganizationCreation();
  }

  get inviteExpiresInMs() {
    return this.resolveInviteExpiresInMs();
  }

  get subdomainSuffix() {
    return this.resolveSubdomainSuffix();
  }
}
