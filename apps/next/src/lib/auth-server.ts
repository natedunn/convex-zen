import { createNextAuthServer } from "convex-zen/next";
import { api } from "../../convex/_generated/api";
import { authMeta } from "../../convex/auth/generated";

const authServer = createNextAuthServer({
	convexUrl: process.env["NEXT_PUBLIC_CONVEX_URL"] as string,
	convexFunctions: api.auth,
	meta: authMeta,
});

export const {
	handler,
	getSession,
	getToken,
	isAuthenticated,
	requireSession,
	fetchQuery,
	fetchMutation,
	fetchAction,
	fetchAuthQuery,
	fetchAuthMutation,
	fetchAuthAction,
} = authServer;
