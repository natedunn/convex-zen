import { createTanStackAuthServer } from "convex-zen/tanstack-start";
import { api } from "../../convex/_generated/api";
import { authPluginMeta } from "../../convex/auth/plugin/metaGenerated";

export const {
	handler,
	getSession,
	fetchAuthQuery,
	fetchAuthMutation,
	fetchAuthAction,
} = createTanStackAuthServer({
	convexUrl: import.meta.env["VITE_CONVEX_URL"] as string,
	convexFunctions: api.auth,
	pluginMeta: authPluginMeta,
});
