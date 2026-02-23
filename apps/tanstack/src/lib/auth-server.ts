import { convexZenReactStart } from "convex-zen/tanstack-start";
import { adminApiPlugin } from "convex-zen/tanstack-start/plugins";
import { api } from "../../convex/_generated/api";

export const {
  handler,
  getSession,
  getToken,
  fetchAuthQuery,
  fetchAuthMutation,
  fetchAuthAction,
} = convexZenReactStart({
  convexUrl: import.meta.env["VITE_CONVEX_URL"] as string,
  actions: api.functions,
  cookieName: "cz_session",
  cookieOptions: {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: import.meta.env.PROD,
    maxAge: 60 * 60 * 12,
  },
  plugins: [
    adminApiPlugin({
      actions: {
        listUsers: api.functions.listUsers,
        banUser: api.functions.banUser,
        setRole: api.functions.setRole,
      },
    }),
  ],
});
