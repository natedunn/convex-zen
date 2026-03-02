import { createTanStackAuthServer } from "convex-zen/tanstack-start";
import { api } from "../../convex/_generated/api";
import { authMeta } from "../../convex/auth/metaGenerated";

const authServer = createTanStackAuthServer({
	convexUrl: import.meta.env["VITE_CONVEX_URL"] as string,
	convexFunctions: api.auth,
	meta: authMeta,
});

export const {
	handler,
	getSession,
	fetchAuthQuery,
	fetchAuthMutation,
	fetchAuthAction,
} = authServer;
