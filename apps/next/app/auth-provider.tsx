"use client";

import { ConvexQueryClient } from "@convex-dev/react-query";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConvexReactClient, ConvexProvider } from "convex/react";
import { ConvexZenAuthProvider } from "convex-zen/react";
import { useEffect, useState, type ReactNode } from "react";
import { authClient } from "@/lib/auth-client";

export function AppAuthProvider({
  initialSession,
  children,
}: {
  initialSession: Awaited<ReturnType<typeof authClient.getSession>>;
  children: ReactNode;
}) {
  const [{ convex, queryClient }] = useState(() => {
    const convex = new ConvexReactClient(
      process.env["NEXT_PUBLIC_CONVEX_URL"] as string
    );
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
      queryClient,
    };
  });

  useEffect(() => authClient.connectConvexAuth(convex), [convex]);

  return (
    <ConvexZenAuthProvider client={authClient} initialSession={initialSession}>
      <ConvexProvider client={convex}>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </ConvexProvider>
    </ConvexZenAuthProvider>
  );
}
