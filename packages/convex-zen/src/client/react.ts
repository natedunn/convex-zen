import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { SessionInfo } from "./primitives";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

export type AuthSession = SessionInfo;

export interface ReactAuthClient {
  getSession: () => Promise<AuthSession | null>;
}

export interface ConvexZenAuthContextValue {
  status: AuthStatus;
  session: AuthSession | null;
  isAuthenticated: boolean;
  refresh: () => Promise<AuthSession | null>;
}

export interface ConvexZenAuthProviderProps {
  client: ReactAuthClient;
  initialSession?: AuthSession | null;
  children: ReactNode;
}

const AuthContext = createContext<ConvexZenAuthContextValue | null>(null);

export function ConvexZenAuthProvider({
  client,
  initialSession,
  children,
}: ConvexZenAuthProviderProps) {
  const [session, setSession] = useState<AuthSession | null>(
    initialSession ?? null
  );
  const [status, setStatus] = useState<AuthStatus>(() => {
    if (initialSession === undefined) {
      return "loading";
    }
    return initialSession ? "authenticated" : "unauthenticated";
  });

  const refresh = useCallback(async () => {
    setStatus("loading");
    const next = await client.getSession();
    setSession(next);
    setStatus(next ? "authenticated" : "unauthenticated");
    return next;
  }, [client]);

  useEffect(() => {
    if (initialSession !== undefined) {
      setSession(initialSession);
      setStatus(initialSession ? "authenticated" : "unauthenticated");
    }
  }, [initialSession]);

  useEffect(() => {
    if (initialSession === undefined) {
      void refresh();
    }
  }, [initialSession, refresh]);

  const value = useMemo<ConvexZenAuthContextValue>(
    () => ({
      status,
      session,
      isAuthenticated: session !== null,
      refresh,
    }),
    [status, session, refresh]
  );

  return createElement(AuthContext.Provider, { value }, children);
}

export function useConvexZenAuth(): ConvexZenAuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useConvexZenAuth must be used within ConvexZenAuthProvider");
  }
  return context;
}

export const useAuth = useConvexZenAuth;

export function useSession(): AuthSession | null {
  return useConvexZenAuth().session;
}
