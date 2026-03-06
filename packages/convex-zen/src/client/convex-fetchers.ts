import { ConvexHttpClient } from "convex/browser";
import type {
  FunctionArgs,
  FunctionReference,
  FunctionReturnType,
} from "convex/server";

export interface ConvexFetchers<TAuthContext> {
  fetchQuery: <Query extends FunctionReference<"query", "public">>(
    fn: Query,
    args: FunctionArgs<Query>
  ) => Promise<FunctionReturnType<Query>>;
  fetchMutation: <Mutation extends FunctionReference<"mutation", "public">>(
    fn: Mutation,
    args: FunctionArgs<Mutation>
  ) => Promise<FunctionReturnType<Mutation>>;
  fetchAction: <Action extends FunctionReference<"action", "public">>(
    fn: Action,
    args: FunctionArgs<Action>
  ) => Promise<FunctionReturnType<Action>>;
  fetchAuthQuery: <Query extends FunctionReference<"query", "public">>(
    authContext: TAuthContext,
    fn: Query,
    args: FunctionArgs<Query>
  ) => Promise<FunctionReturnType<Query>>;
  fetchAuthMutation: <Mutation extends FunctionReference<"mutation", "public">>(
    authContext: TAuthContext,
    fn: Mutation,
    args: FunctionArgs<Mutation>
  ) => Promise<FunctionReturnType<Mutation>>;
  fetchAuthAction: <Action extends FunctionReference<"action", "public">>(
    authContext: TAuthContext,
    fn: Action,
    args: FunctionArgs<Action>
  ) => Promise<FunctionReturnType<Action>>;
}

export interface ConvexFetchersOptions<TAuthContext> {
  convexUrl: string;
  resolveAuthToken: (authContext: TAuthContext) => Promise<string>;
}

/**
 * Shared Convex fetcher factory used by framework adapters.
 *
 * Public fetchers use an unauthenticated Convex client.
 * Authenticated fetchers resolve a token from framework-specific context.
 */
export function createConvexFetchers<TAuthContext>(
  options: ConvexFetchersOptions<TAuthContext>
): ConvexFetchers<TAuthContext> {
  const publicConvex = new ConvexHttpClient(options.convexUrl);
  const withAuthenticatedConvexClient = async <T>(
    authContext: TAuthContext,
    runner: (client: ConvexHttpClient) => Promise<T>
  ): Promise<T> => {
    const token = await options.resolveAuthToken(authContext);
    const convex = new ConvexHttpClient(options.convexUrl);
    convex.setAuth(token);
    return runner(convex);
  };

  return {
    fetchQuery: async (fn, args) => {
      return publicConvex.query(fn, args);
    },
    fetchMutation: async (fn, args) => {
      return publicConvex.mutation(fn, args);
    },
    fetchAction: async (fn, args) => {
      return publicConvex.action(fn, args);
    },
    fetchAuthQuery: async (authContext, fn, args) => {
      return withAuthenticatedConvexClient(authContext, (convex) =>
        convex.query(fn, args)
      );
    },
    fetchAuthMutation: async (authContext, fn, args) => {
      return withAuthenticatedConvexClient(authContext, (convex) =>
        convex.mutation(fn, args)
      );
    },
    fetchAuthAction: async (authContext, fn, args) => {
      return withAuthenticatedConvexClient(authContext, (convex) =>
        convex.action(fn, args)
      );
    },
  };
}
