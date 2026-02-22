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
      validate: InternalAction;
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
      signUp: InternalAction;
      signIn: InternalAction;
      verifyEmail: InternalAction;
      requestPasswordReset: InternalAction;
      resetPassword: InternalAction;
      updatePasswordHash: InternalMutation;
    };
    oauth: {
      getAuthorizationUrl: InternalAction;
      handleCallback: InternalAction;
      storeOAuthState: InternalMutation;
      consumeOAuthState: InternalMutation;
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
  };
};
