import { createNextAuthClient } from "convex-zen/next";
import { api } from "../../convex/_generated/api";
import { authMeta } from "../../convex/auth/metaGenerated";

export const authClient = createNextAuthClient({
	convexFunctions: api.auth,
	meta: authMeta,
});
