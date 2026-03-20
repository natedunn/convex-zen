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
    signInWithEmail: mutationRef("zen/core:signInWithEmail"),
    validateSession: mutationRef("zen/core:validateSession"),
    invalidateSession: mutationRef("zen/core:invalidateSession"),
    getOAuthUrl: mutationRef("zen/core:getOAuthUrl"),
    handleOAuthCallback: actionRef("zen/core:handleOAuthCallback"),
    currentUser: queryRef("zen/core:currentUser"),
  },
  plugin: {
    admin: {
      listUsers: queryRef("zen/plugin/admin:listUsers"),
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
