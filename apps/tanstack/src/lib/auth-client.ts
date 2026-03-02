import { createTanStackQueryAuthClient } from "convex-zen/tanstack-start-client";
import { api } from "../../convex/_generated/api";
import { authMeta } from "../../convex/auth/metaGenerated";

export const authClient = createTanStackQueryAuthClient({
	convexFunctions: api.auth,
	meta: authMeta,
});
