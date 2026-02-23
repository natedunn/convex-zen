import { createRouter as createTanstackRouter } from "@tanstack/react-router";
import { ConvexQueryClient } from "@convex-dev/react-query";
import { QueryClient } from "@tanstack/react-query";
import { routerWithQueryClient } from "@tanstack/react-router-with-query";
import { ConvexReactClient } from "convex/react";
import { routeTree } from "./routeTree.gen";

function createRouterContext() {
  const convex = new ConvexReactClient(import.meta.env["VITE_CONVEX_URL"] as string);
  const convexQueryClient = new ConvexQueryClient(convex);
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        queryKeyHashFn: convexQueryClient.hashFn(),
        queryFn: convexQueryClient.queryFn(),
      },
    },
  });
  convexQueryClient.connect(queryClient);

  return {
    convex,
    convexQueryClient,
    queryClient,
  };
}

export type RouterContext = ReturnType<typeof createRouterContext>;

export function getRouter() {
  const context = createRouterContext();
  const router = createTanstackRouter({
    routeTree,
    context,
    defaultPreload: "intent",
    scrollRestoration: true,
  });

  return routerWithQueryClient(router, context.queryClient);
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
