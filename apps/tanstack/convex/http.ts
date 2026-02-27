import { httpRouter } from "convex/server";
import { auth } from "./zenConvex";

const http = httpRouter();

/**
 * OAuth callback routes.
 * These receive the redirect from Google/GitHub after the user authorizes.
 * The handler extracts the code + state and calls handleOAuthCallback.
 */
auth.registerRoutes(http);

export default http;
