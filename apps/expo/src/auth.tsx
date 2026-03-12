import "react-native-url-polyfill/auto";
import * as AuthSession from "expo-auth-session";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  createExpoAuthClient,
  createKeyValueStorageAuthStorage,
  type AuthKeyValueStorage,
  type ExpoOAuthResult,
} from "convex-zen/expo";
import { authFunctions, authMeta } from "./authFunctions";

WebBrowser.maybeCompleteAuthSession();

const convexUrl =
  process.env.EXPO_PUBLIC_CONVEX_URL ?? "https://example.convex.cloud";
const appScheme = process.env.EXPO_PUBLIC_APP_SCHEME ?? "convexzenexpo";

const authClient = createExpoAuthClient({
  convexUrl,
  convexFunctions: authFunctions,
  meta: authMeta,
  runtime: {
    storage: createKeyValueStorageAuthStorage(
      {
        getItem: (key: string) => SecureStore.getItemAsync(key),
        setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
        removeItem: (key: string) => SecureStore.deleteItemAsync(key),
      } satisfies AuthKeyValueStorage
    ),
  },
});

type CurrentUser = Awaited<ReturnType<typeof authClient.currentUser>>;
type SessionInfo = Awaited<ReturnType<typeof authClient.getSession>>;
type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  status: AuthStatus;
  session: SessionInfo | null;
  currentUser: CurrentUser | null;
  error: string | null;
  callbackUrl: string;
  refresh: () => Promise<SessionInfo | null>;
  signInWithEmail: (input: {
    email: string;
    password: string;
  }) => Promise<SessionInfo>;
  signInWithGoogle: () => Promise<ExpoOAuthResult | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function parseOAuthCallback(url: string): { code: string; state: string } {
  const parsed = new URL(url);
  const code = parsed.searchParams.get("code");
  const state = parsed.searchParams.get("state");
  if (!code || !state) {
    throw new Error("OAuth callback is missing code or state");
  }
  return { code, state };
}

export function ExpoAuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  const callbackUrl = useMemo(
    () => AuthSession.makeRedirectUri({ scheme: appScheme, path: "oauth" }),
    []
  );

  const refresh = useCallback(async (): Promise<SessionInfo | null> => {
    try {
      const nextSession = await authClient.getSession();
      const nextCurrentUser = nextSession
        ? await authClient.currentUser({})
        : null;
      startTransition(() => {
        setSession(nextSession);
        setCurrentUser(nextCurrentUser);
        setStatus(nextSession ? "authenticated" : "unauthenticated");
        setError(null);
      });
      return nextSession;
    } catch (refreshError) {
      startTransition(() => {
        setSession(null);
        setCurrentUser(null);
        setStatus("unauthenticated");
        setError(
          refreshError instanceof Error ? refreshError.message : "Could not refresh session"
        );
      });
      return null;
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const signInWithEmail = useCallback(
    async (input: { email: string; password: string }) => {
      const nextSession = await authClient.signIn.email(input);
      const nextCurrentUser = await authClient.currentUser({});
      startTransition(() => {
        setSession(nextSession);
        setCurrentUser(nextCurrentUser);
        setStatus("authenticated");
        setError(null);
      });
      return nextSession;
    },
    []
  );

  const signInWithGoogle = useCallback(async (): Promise<ExpoOAuthResult | null> => {
    const redirectTo = "/home";
    const errorRedirectTo = "/sign-in";
    try {
      const start = await authClient.signIn.oauth("google", {
        callbackUrl,
        redirectTo,
        errorRedirectTo,
      });

      const browserResult = await WebBrowser.openAuthSessionAsync(
        start.authorizationUrl,
        callbackUrl
      );

      if (browserResult.type !== "success" || !browserResult.url) {
        return null;
      }

      const { code, state } = parseOAuthCallback(browserResult.url);
      const result = await authClient.completeOAuth({
        providerId: "google",
        code,
        state,
        callbackUrl,
        redirectTo,
        errorRedirectTo,
      });
      const nextCurrentUser = await authClient.currentUser({});
      startTransition(() => {
        setSession(result.session);
        setCurrentUser(nextCurrentUser);
        setStatus("authenticated");
        setError(null);
      });
      return result;
    } catch (oauthError) {
      startTransition(() => {
        setError(
          oauthError instanceof Error ? oauthError.message : "Could not complete Google OAuth"
        );
      });
      return null;
    }
  }, [callbackUrl]);

  const signOut = useCallback(async () => {
    await authClient.signOut();
    startTransition(() => {
      setSession(null);
      setCurrentUser(null);
      setStatus("unauthenticated");
      setError(null);
    });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      session,
      currentUser,
      error,
      callbackUrl,
      refresh,
      signInWithEmail,
      signInWithGoogle,
      signOut,
    }),
    [callbackUrl, currentUser, error, refresh, session, signInWithEmail, signInWithGoogle, signOut, status]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useExpoAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useExpoAuth must be used within ExpoAuthProvider");
  }
  return context;
}
