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

export interface ConvexZenSessionContextValue {
  status: AuthStatus;
  session: AuthSession | null;
  isAuthenticated: boolean;
  refresh: () => Promise<AuthSession | null>;
}

export interface ConvexZenAuthProviderProps<
  TClient extends ReactAuthClient = ReactAuthClient,
> {
  client: TClient;
  initialSession?: AuthSession | null;
  children: ReactNode;
}

const SessionContext = createContext<ConvexZenSessionContextValue | null>(null);

export function ConvexZenAuthProvider<
  TClient extends ReactAuthClient = ReactAuthClient,
>({ client, initialSession, children }: ConvexZenAuthProviderProps<TClient>) {
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

  const sessionValue = useMemo<ConvexZenSessionContextValue>(
    () => ({
      status,
      session,
      isAuthenticated: session !== null,
      refresh,
    }),
    [status, session, refresh]
  );

  return createElement(SessionContext.Provider, { value: sessionValue }, children);
}

function useSessionContext(): ConvexZenSessionContextValue {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error(
      "useZenSession must be used within ConvexZenAuthProvider"
    );
  }
  return context;
}

export function useZenSession(): ConvexZenSessionContextValue {
  return useSessionContext();
}

export function useSession(): ConvexZenSessionContextValue {
  return useZenSession();
}
