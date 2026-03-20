import { createNextAuthClient } from "convex-zen/next";
import { api } from "../../convex/_generated/api";
import { authMeta } from "../../convex/auth/generated";

export const authClient = createNextAuthClient({
	convexFunctions: api.auth,
	meta: authMeta,
});

export type AppAuthClient = typeof authClient;
