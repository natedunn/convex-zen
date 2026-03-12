import {
  makeFunctionReference,
  type FunctionReference,
} from "convex/server";
import type { ExpoAuthMeta } from "convex-zen/expo";

function queryRef(name: string): FunctionReference<"query", "public"> {
  return makeFunctionReference<"query", Record<string, unknown>, unknown>(name);
}

function mutationRef(name: string): FunctionReference<"mutation", "public"> {
  return makeFunctionReference<"mutation", Record<string, unknown>, unknown>(name);
}

function actionRef(name: string): FunctionReference<"action", "public"> {
  return makeFunctionReference<"action", Record<string, unknown>, unknown>(name);
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
