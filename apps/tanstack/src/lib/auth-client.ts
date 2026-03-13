import { createTanStackAuthClient } from "convex-zen/tanstack-start";
import { api } from "../../convex/_generated/api";
import { authMeta } from "../../convex/auth/metaGenerated";

export const authClient = createTanStackAuthClient({
	convexFunctions: api.auth,
	meta: authMeta,
});

export type AppAuthClient = typeof authClient;
