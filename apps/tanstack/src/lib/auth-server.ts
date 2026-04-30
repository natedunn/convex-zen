import { createTanStackAuthServer } from "convex-zen/tanstack-start";
import { api } from "../../convex/_generated/api";
import { authMeta } from "../../convex/zen/_generated/meta";

const authServer = createTanStackAuthServer({
	convexUrl: import.meta.env["VITE_CONVEX_URL"] as string,
	convexFunctions: api.zen,
	meta: authMeta,
	oauthProxy: true,
});

export const {
	handler,
	getSession,
	fetchAuthQuery,
	fetchAuthMutation,
	fetchAuthAction,
} = authServer;
