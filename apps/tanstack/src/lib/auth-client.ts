import { createServerFn } from "@tanstack/react-start";
import { createTanStackStartAuthApiClient } from "convex-zen/tanstack-start-client";
import { adminClient } from "convex-zen/tanstack-start-client/plugins";
import { getSession as getServerSession } from "./auth-server";

export const getSession = createServerFn({ method: "GET" }).handler(async () =>
	getServerSession(),
);

export const authClient = createTanStackStartAuthApiClient({
  plugins: [adminClient()],
});
