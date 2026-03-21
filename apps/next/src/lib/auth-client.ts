import { createNextAuthClient } from "convex-zen/next";
import { api } from "../../convex/_generated/api";
import { authMeta } from "../../convex/zen/_generated/meta";

export const authClient = createNextAuthClient({
	convexFunctions: api.zen,
	meta: authMeta,
});

export type AppAuthClient = typeof authClient;
