import { createServerFn } from "@tanstack/react-start";
import { deleteCookie, getCookie, setCookie } from "@tanstack/react-start/server";
import type { SignInInput } from "./primitives";
import type { SessionPrimitives } from "./primitives";

type SetCookieOptions = Exclude<Parameters<typeof setCookie>[2], undefined>;
type DeleteCookieOptions = Exclude<
  Parameters<typeof deleteCookie>[1],
  undefined
>;

export interface TanStackStartAuthOptions {
  primitives: SessionPrimitives;
  cookieName?: string;
  cookieOptions?: Partial<SetCookieOptions>;
}

function resolveCookieOptions(
  options?: Partial<SetCookieOptions>
): SetCookieOptions {
  return {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    ...options,
  };
}

/**
 * TanStack Start adapter.
 *
 * Exposes server functions that read/write an HttpOnly session cookie and
 * delegate auth logic to the framework-agnostic SessionPrimitives.
 */
export function createTanStackStartAuth(options: TanStackStartAuthOptions) {
  const cookieName = options.cookieName ?? "cz_session";
  const cookieOptions = resolveCookieOptions(options.cookieOptions);
  const clearCookieOptions: DeleteCookieOptions = {
    path: cookieOptions.path ?? "/",
  };

  const getSession = createServerFn({ method: "GET" }).handler(async () => {
    const token = getCookie(cookieName);
    const session = await options.primitives.getSessionFromToken(token);

    if (!session && token) {
      deleteCookie(cookieName, clearCookieOptions);
    }

    return session;
  });

  const signIn = createServerFn({ method: "POST" })
    .inputValidator((input: SignInInput) => input)
    .handler(async ({ data }) => {
      const established = await options.primitives.signInAndResolveSession(data);
      setCookie(cookieName, established.sessionToken, cookieOptions);
      return established.session;
    });

  const signOut = createServerFn({ method: "POST" }).handler(async () => {
    const token = getCookie(cookieName);
    try {
      await options.primitives.signOutByToken(token);
    } finally {
      deleteCookie(cookieName, clearCookieOptions);
    }
    return null;
  });

  return {
    getSession,
    signIn,
    signOut,
  };
}
