import { createNextAuthClient } from "convex-zen/next";
import { authConvexFunctions } from "../../convex/auth/clientGenerated";
import { authMeta } from "../../convex/auth/metaGenerated";

export const authClient = createNextAuthClient({
	convexFunctions: authConvexFunctions,
	meta: authMeta,
});

export type AppAuthClient = typeof authClient;
