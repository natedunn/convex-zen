import { createTanStackAuthClient } from "convex-zen/tanstack-start-client";
import { api } from "../../convex/_generated/api";
import { authPluginMeta } from "../../convex/auth/plugin/metaGenerated";

const test = Object.keys(api.auth.plugin.admin);

export const authClient = createTanStackAuthClient({
	convexFunctions: api.auth,
	pluginMeta: authPluginMeta,
});

export const getSession = () => authClient.getSession();
