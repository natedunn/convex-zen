import type {
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
  runQuery: (fn: unknown, args: Record<string, unknown>) => Promise<unknown>;
};

type RunsMutations = {
  runMutation: (fn: unknown, args: Record<string, unknown>) => Promise<unknown>;
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

export function organizationPlugin<
  const TCustomAccessControl extends OrganizationCustomAccessControl = {},
  const TCustomRoles extends OrganizationCustomRoleDefinitions<
    OrganizationAccessControl<TCustomAccessControl>
  > = {},
>(config?: {
  allowUserOrganizationCreation?: boolean;
  inviteExpiresInMs?: number;
  subdomainSuffix?: string;
  accessControl?: TCustomAccessControl;
  roles?: OrganizationRoleDefinitions<
    OrganizationAccessControl<TCustomAccessControl>,
    TCustomRoles
  >;
}): OrganizationPluginConfig<TCustomAccessControl, TCustomRoles> {
  const plugin: OrganizationPluginConfig<TCustomAccessControl, TCustomRoles> = {
    id: "organization",
    allowUserOrganizationCreation: true,
    inviteExpiresInMs: DEFAULT_INVITE_EXPIRES_MS,
  };
  if (config?.allowUserOrganizationCreation !== undefined) {
    plugin.allowUserOrganizationCreation = config.allowUserOrganizationCreation;
  }
  if (config?.inviteExpiresInMs !== undefined) {
    plugin.inviteExpiresInMs = config.inviteExpiresInMs;
  }
  if (config?.subdomainSuffix !== undefined) {
    plugin.subdomainSuffix = config.subdomainSuffix;
  }
  if (config?.accessControl !== undefined) {
    plugin.accessControl = config.accessControl;
  }
  if (config?.roles !== undefined) {
    plugin.roles = config.roles;
  }
  return plugin;
}

export class OrganizationPlugin<
  TCustomAccessControl extends OrganizationCustomAccessControl = {},
  TCustomRoles extends OrganizationCustomRoleDefinitions<
    OrganizationAccessControl<TCustomAccessControl>
  > = {},
> {
  constructor(
    private readonly componentApi: Record<string, unknown>,
    private readonly config: OrganizationPluginConfig<TCustomAccessControl, TCustomRoles>
  ) {}

  private fn(path: string): unknown {
    const [modulePath, funcName] = path.split(":");
    if (!modulePath || !funcName) {
      throw new Error(`Invalid function path: ${path}`);
    }
    const parts = modulePath.split("/");
    let ref: Record<string, unknown> = this.componentApi;
    for (const part of parts) {
      const next = ref[part];
      if (!next || typeof next !== "object" || Array.isArray(next)) {
        throw new Error(`Invalid function path segment: ${part}`);
      }
      ref = next as Record<string, unknown>;
    }
    const resolved = ref[funcName];
    if (!resolved) {
      throw new Error(`Function not found: ${path}`);
    }
    return resolved;
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

  async checkSlug(
    ctx: RunsQueries,
    args: { slug: string }
  ): Promise<OrganizationSlugCheckResult> {
    return this.runGatewayQuery(ctx, "gateway:organizationCheckSlug", args) as Promise<OrganizationSlugCheckResult>;
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
    return this.runGatewayMutation(ctx, "gateway:organizationCreate", {
      ...args,
      allowUserOrganizationCreation: this.resolveAllowUserOrganizationCreation(),
    }) as Promise<{ organization: Organization; membership: OrganizationMembership }>;
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
    return this.runGatewayMutation(ctx, "gateway:organizationUpdate", {
      ...args,
      rolePermissions: this.resolveRolePermissions(),
    }) as Promise<Organization>;
  }

  async deleteOrganization(
    ctx: RunsMutations,
    args: { actorUserId: string; organizationId: string }
  ): Promise<void> {
    return this.runGatewayMutation(ctx, "gateway:organizationDelete", {
      ...args,
      rolePermissions: this.resolveRolePermissions(),
    }) as Promise<void>;
  }

  async listOrganizations(
    ctx: RunsQueries,
    args: { actorUserId: string }
  ): Promise<OrganizationListResult> {
    return this.runGatewayQuery(ctx, "gateway:organizationList", args) as Promise<OrganizationListResult>;
  }

  async getOrganization(
    ctx: RunsQueries,
    args: { actorUserId: string; organizationId: string }
  ): Promise<Organization | null> {
    return this.runGatewayQuery(ctx, "gateway:organizationGet", {
      ...args,
      rolePermissions: this.resolveRolePermissions(),
    }) as Promise<Organization | null>;
  }

  async getMembership(
    ctx: RunsQueries,
    args: { actorUserId: string; organizationId: string }
  ): Promise<OrganizationMembership | null> {
    return this.runGatewayQuery(ctx, "gateway:organizationGetMembership", args) as Promise<OrganizationMembership | null>;
  }

  async listMembers(
    ctx: RunsQueries,
    args: { actorUserId: string; organizationId: string }
  ): Promise<OrganizationMember[]> {
    return this.runGatewayQuery(ctx, "gateway:organizationListMembers", {
      ...args,
      rolePermissions: this.resolveRolePermissions(),
    }) as Promise<OrganizationMember[]>;
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
    return this.runGatewayMutation(ctx, "gateway:organizationInviteMember", {
      ...args,
      inviteExpiresInMs: this.resolveInviteExpiresInMs(),
      accessControl: this.resolveAccessControl(),
      rolePermissions: this.resolveRolePermissions(),
    }) as Promise<{ invitation: OrganizationInvitation; token: string }>;
  }

  async listInvitations(
    ctx: RunsQueries,
    args: { actorUserId: string; organizationId: string }
  ): Promise<OrganizationInvitation[]> {
    return this.runGatewayQuery(ctx, "gateway:organizationListInvitations", {
      ...args,
      rolePermissions: this.resolveRolePermissions(),
    }) as Promise<OrganizationInvitation[]>;
  }

  async listIncomingInvitations(
    ctx: RunsQueries,
    args: { actorUserId: string }
  ): Promise<OrganizationIncomingInvitation[]> {
    return this.runGatewayQuery(ctx, "gateway:organizationListIncomingInvitations", {
      ...args,
    }) as Promise<OrganizationIncomingInvitation[]>;
  }

  async acceptInvitation(
    ctx: RunsMutations,
    args: { actorUserId: string; token: string }
  ): Promise<OrganizationInvitation> {
    return this.runGatewayMutation(ctx, "gateway:organizationAcceptInvitation", {
      ...args,
      rolePermissions: this.resolveRolePermissions(),
    }) as Promise<OrganizationInvitation>;
  }

  async acceptIncomingInvitation(
    ctx: RunsMutations,
    args: { actorUserId: string; invitationId: string }
  ): Promise<OrganizationInvitation> {
    return this.runGatewayMutation(
      ctx,
      "gateway:organizationAcceptIncomingInvitation",
      {
        ...args,
      }
    ) as Promise<OrganizationInvitation>;
  }

  async cancelInvitation(
    ctx: RunsMutations,
    args: { actorUserId: string; invitationId: string }
  ): Promise<OrganizationInvitation> {
    return this.runGatewayMutation(ctx, "gateway:organizationCancelInvitation", {
      ...args,
      rolePermissions: this.resolveRolePermissions(),
    }) as Promise<OrganizationInvitation>;
  }

  async declineIncomingInvitation(
    ctx: RunsMutations,
    args: { actorUserId: string; invitationId: string }
  ): Promise<OrganizationInvitation> {
    return this.runGatewayMutation(
      ctx,
      "gateway:organizationDeclineIncomingInvitation",
      {
        ...args,
      }
    ) as Promise<OrganizationInvitation>;
  }

  async removeMember(
    ctx: RunsMutations,
    args: { actorUserId: string; organizationId: string; userId: string }
  ): Promise<void> {
    return this.runGatewayMutation(ctx, "gateway:organizationRemoveMember", {
      ...args,
      rolePermissions: this.resolveRolePermissions(),
    }) as Promise<void>;
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
    return this.runGatewayMutation(ctx, "gateway:organizationSetMemberRole", {
      ...args,
      rolePermissions: this.resolveRolePermissions(),
    }) as Promise<OrganizationMembership>;
  }

  async transferOwnership(
    ctx: RunsMutations,
    args: {
      actorUserId: string;
      organizationId: string;
      newOwnerUserId: string;
    }
  ): Promise<void> {
    return this.runGatewayMutation(ctx, "gateway:organizationTransferOwnership", {
      ...args,
      rolePermissions: this.resolveRolePermissions(),
    }) as Promise<void>;
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
    return this.runGatewayMutation(ctx, "gateway:organizationCreateRole", {
      ...args,
      accessControl: this.resolveAccessControl(),
      rolePermissions: this.resolveRolePermissions(),
    }) as Promise<OrganizationRoleRecord>;
  }

  async listRoles(
    ctx: RunsQueries,
    args: { actorUserId: string; organizationId: string }
  ): Promise<OrganizationRoleListResult> {
    return this.runGatewayQuery(ctx, "gateway:organizationListRoles", {
      ...args,
      rolePermissions: this.resolveRolePermissions(),
    }) as Promise<OrganizationRoleListResult>;
  }

  async listAvailablePermissions(
    ctx: RunsQueries,
    args: { actorUserId: string; organizationId: string }
  ): Promise<OrganizationAvailablePermissionsResult> {
    return this.runGatewayQuery(ctx, "gateway:organizationListAvailablePermissions", {
      ...args,
      accessControl: this.resolveAccessControl(),
      rolePermissions: this.resolveRolePermissions(),
    }) as Promise<OrganizationAvailablePermissionsResult>;
  }

  async getRole(
    ctx: RunsQueries,
    args: { actorUserId: string; roleId: string }
  ): Promise<OrganizationRoleRecord | null> {
    return this.runGatewayQuery(ctx, "gateway:organizationGetRole", {
      ...args,
      rolePermissions: this.resolveRolePermissions(),
    }) as Promise<OrganizationRoleRecord | null>;
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
    return this.runGatewayMutation(ctx, "gateway:organizationUpdateRole", {
      ...args,
      accessControl: this.resolveAccessControl(),
      rolePermissions: this.resolveRolePermissions(),
    }) as Promise<OrganizationRoleRecord>;
  }

  async deleteRole(
    ctx: RunsMutations,
    args: { actorUserId: string; roleId: string }
  ): Promise<void> {
    return this.runGatewayMutation(ctx, "gateway:organizationDeleteRole", {
      ...args,
      rolePermissions: this.resolveRolePermissions(),
    }) as Promise<void>;
  }

  async addDomain(
    ctx: RunsMutations,
    args: { actorUserId: string; organizationId: string; hostname: string }
  ): Promise<OrganizationDomain> {
    return this.runGatewayMutation(ctx, "gateway:organizationAddDomain", {
      ...args,
      rolePermissions: this.resolveRolePermissions(),
    }) as Promise<OrganizationDomain>;
  }

  async listDomains(
    ctx: RunsQueries,
    args: { actorUserId: string; organizationId: string }
  ): Promise<OrganizationDomain[]> {
    return this.runGatewayQuery(ctx, "gateway:organizationListDomains", {
      ...args,
      rolePermissions: this.resolveRolePermissions(),
    }) as Promise<OrganizationDomain[]>;
  }

  async getDomainVerificationChallenge(
    ctx: RunsQueries,
    args: { actorUserId: string; domainId: string }
  ): Promise<OrganizationDomainVerificationChallenge> {
    return this.runGatewayQuery(
      ctx,
      "gateway:organizationGetDomainVerificationChallenge",
      {
        ...args,
        rolePermissions: this.resolveRolePermissions(),
      }
    ) as Promise<OrganizationDomainVerificationChallenge>;
  }

  async markDomainVerified(
    ctx: RunsMutations,
    args: { actorUserId: string; domainId: string }
  ): Promise<OrganizationDomain> {
    return this.runGatewayMutation(ctx, "gateway:organizationMarkDomainVerified", {
      ...args,
      rolePermissions: this.resolveRolePermissions(),
    }) as Promise<OrganizationDomain>;
  }

  async removeDomain(
    ctx: RunsMutations,
    args: { actorUserId: string; domainId: string }
  ): Promise<void> {
    return this.runGatewayMutation(ctx, "gateway:organizationRemoveDomain", {
      ...args,
      rolePermissions: this.resolveRolePermissions(),
    }) as Promise<void>;
  }

  async resolveOrganizationByHost(
    ctx: RunsQueries,
    args: { host: string }
  ): Promise<Organization | null> {
    return this.runGatewayQuery(ctx, "gateway:organizationResolveByHost", {
      host: args.host,
      subdomainSuffix: this.resolveSubdomainSuffix(),
    }) as Promise<Organization | null>;
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
    return this.runGatewayQuery(ctx, "gateway:organizationHasRole", args) as Promise<boolean>;
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
    return this.runGatewayQuery(ctx, "gateway:organizationRequireRole", args) as Promise<OrganizationMembership>;
  }

  async hasPermission(
    ctx: RunsQueries,
    args: {
      actorUserId: string;
      organizationId: string;
      permission: OrganizationPermission<OrganizationAccessControl<TCustomAccessControl>>;
    }
  ): Promise<boolean> {
    return this.runGatewayQuery(ctx, "gateway:organizationHasPermission", {
      actorUserId: args.actorUserId,
      organizationId: args.organizationId,
      permission: this.permissionPayload(args.permission),
      rolePermissions: this.resolveRolePermissions(),
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
    return this.runGatewayQuery(ctx, "gateway:organizationRequirePermission", {
      actorUserId: args.actorUserId,
      organizationId: args.organizationId,
      permission: this.permissionPayload(args.permission),
      rolePermissions: this.resolveRolePermissions(),
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
