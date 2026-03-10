import type { FunctionReference } from "convex/server";
import type { ExpoAuthMeta } from "convex-zen/expo";

function queryRef(name: string): FunctionReference<"query", "public"> {
  return { name } as unknown as FunctionReference<"query", "public">;
}

function mutationRef(name: string): FunctionReference<"mutation", "public"> {
  return { name } as unknown as FunctionReference<"mutation", "public">;
}

function actionRef(name: string): FunctionReference<"action", "public"> {
  return { name } as unknown as FunctionReference<"action", "public">;
}

export const authFunctions = {
  core: {
    signInWithEmail: mutationRef("auth/core:signInWithEmail"),
    validateSession: mutationRef("auth/core:validateSession"),
    invalidateSession: mutationRef("auth/core:invalidateSession"),
    getOAuthUrl: mutationRef("auth/core:getOAuthUrl"),
    handleOAuthCallback: actionRef("auth/core:handleOAuthCallback"),
    currentUser: queryRef("auth/core:currentUser"),
  },
  plugin: {
    admin: {
      listUsers: queryRef("auth/core:listUsers"),
    },
  },
} as const;

export const authMeta = {
  core: {
    currentUser: "query",
  },
  plugin: {
    admin: {
      listUsers: "query",
    },
  },
} as const satisfies ExpoAuthMeta;
