import { anyApi } from "convex/server";
import type { FunctionReference } from "convex/server";

type InternalQuery = FunctionReference<"query", "internal">;
type InternalMutation = FunctionReference<"mutation", "internal">;
type InternalAction = FunctionReference<"action", "internal">;

export const internal = anyApi as unknown as {
  core: {
    sessions: {
      create: InternalMutation;
      getByToken: InternalQuery;
      validate: InternalMutation;
      extend: InternalMutation;
      invalidateByHash: InternalMutation;
      invalidateByToken: InternalMutation;
      invalidateAll: InternalMutation;
    };
    users: {
      create: InternalMutation;
      getByEmail: InternalQuery;
      getById: InternalQuery;
      update: InternalMutation;
      createAccount: InternalMutation;
      getAccount: InternalQuery;
      updateAccount: InternalMutation;
    };
    verifications: {
      create: InternalMutation;
      verify: InternalMutation;
      cleanup: InternalMutation;
    };
  };
  lib: {
    rateLimit: {
      check: InternalQuery;
      increment: InternalMutation;
      reset: InternalMutation;
    };
  };
  providers: {
    emailPassword: {
      signUp: InternalMutation;
      signIn: InternalMutation;
      verifyEmail: InternalMutation;
      requestPasswordReset: InternalMutation;
      resetPassword: InternalMutation;
      updatePasswordHash: InternalMutation;
    };
    oauth: {
      getAuthorizationUrl: InternalMutation;
      handleCallback: InternalAction;
      storeOAuthState: InternalMutation;
      consumeOAuthState: InternalMutation;
      cleanup: InternalMutation;
    };
  };
  plugins: {
    admin: {
      listUsers: InternalQuery;
      banUser: InternalMutation;
      unbanUser: InternalMutation;
      setRole: InternalMutation;
      deleteUser: InternalMutation;
    };
    organization: {
      checkSlug: InternalQuery;
      createOrganization: InternalMutation;
      updateOrganization: InternalMutation;
      deleteOrganization: InternalMutation;
      listOrganizations: InternalQuery;
      getOrganization: InternalQuery;
      getMembership: InternalQuery;
      listMembers: InternalQuery;
      createRole: InternalMutation;
      listRoles: InternalQuery;
      listAvailablePermissions: InternalQuery;
      getRole: InternalQuery;
      updateRole: InternalMutation;
      deleteRole: InternalMutation;
      inviteMember: InternalMutation;
      listInvitations: InternalQuery;
      listIncomingInvitations: InternalQuery;
      acceptInvitation: InternalMutation;
      acceptIncomingInvitation: InternalMutation;
      cancelInvitation: InternalMutation;
      declineIncomingInvitation: InternalMutation;
      removeMember: InternalMutation;
      setMemberRole: InternalMutation;
      transferOwnership: InternalMutation;
      addDomain: InternalMutation;
      listDomains: InternalQuery;
      getDomainVerificationChallenge: InternalQuery;
      markDomainVerified: InternalMutation;
      removeDomain: InternalMutation;
      resolveOrganizationByHost: InternalQuery;
      hasRole: InternalQuery;
      requireRole: InternalQuery;
      hasPermission: InternalQuery;
      requirePermission: InternalQuery;
    };
  };
};
