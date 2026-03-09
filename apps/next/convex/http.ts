import { httpRouter } from "convex/server";
import { auth } from "./zen.config";

const http = httpRouter();

/**
 * Optional low-level Convex HTTP routes for manual/custom OAuth flows.
 * Next.js apps should prefer the built-in `/api/auth/sign-in/:provider`
 * and `/api/auth/callback/:provider` routes from createNextAuthServer(...).
 */
auth.registerRoutes(http);

export default http;
