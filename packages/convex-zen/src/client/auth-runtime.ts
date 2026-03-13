import {
  createAuthTokenManager,
  type AuthTokenPayload,
} from "./auth-token-manager";

type MaybePromise<T> = T | Promise<T>;

export interface ConvexAuthClientLike {
  setAuth: (
    fetchAccessToken: () => Promise<string | null>,
    onChange?: (isAuthenticated: boolean) => void
  ) => void;
  clearAuth: () => void;
}

export type AuthStatus =
  | "anonymous"
  | "authenticating"
  | "authenticated"
  | "refreshing"
  | "stale";

export interface AuthRuntimeState {
  status: AuthStatus;
  token: string | null;
  issuedAtMs?: number;
  expiresAtMs?: number;
  lastRefreshAtMs?: number;
  lastError?: Error;
}

export type AuthRuntimeEvent =
  | { type: "state"; state: AuthRuntimeState }
  | { type: "token"; payload: AuthTokenPayload }
  | { type: "signed-in" }
  | { type: "signed-out" }
  | { type: "invalidated"; reason?: string }
  | { type: "error"; error: Error };

export interface AuthRuntimeStorage {
  get: () => MaybePromise<AuthTokenPayload | null>;
  set: (payload: AuthTokenPayload | null) => MaybePromise<void>;
  clear: () => MaybePromise<void>;
}

export type AuthSyncSignal =
  | "token-invalidated"
  | "token-cleared"
  | "signed-in"
  | "signed-out";

export interface AuthRuntimeSync {
  publish: (signal: AuthSyncSignal) => void;
  subscribe: (listener: (signal: AuthSyncSignal) => void) => () => void;
}

export interface AuthRuntimeTokenProvider {
  getToken: (options?: { forceRefresh?: boolean }) => Promise<AuthTokenPayload>;
}

export interface AuthRuntimeOptions {
  tokenProvider: AuthRuntimeTokenProvider;
  storage?: AuthRuntimeStorage;
  sync?: AuthRuntimeSync;
  now?: () => number;
  refreshSkewMs?: number;
  maxUnauthorizedRefreshRetries?: number;
  debug?: boolean;
}

export interface AuthRuntime {
  getState: () => AuthRuntimeState;
  subscribe: (listener: (event: AuthRuntimeEvent) => void) => () => void;
  getToken: (options?: { forceRefresh?: boolean }) => Promise<string | null>;
  getTokenPayload: (
    options?: { forceRefresh?: boolean }
  ) => Promise<AuthTokenPayload>;
  onSignedIn: () => Promise<void>;
  onSignedOut: () => Promise<void>;
  invalidate: (reason?: string) => Promise<void>;
  clear: () => Promise<void>;
  onUnauthorized: (error?: unknown) => Promise<void>;
  mountConvex: (client: ConvexAuthClientLike) => () => void;
}

export interface LocalStorageAuthStorageOptions {
  key?: string;
}

export interface AuthKeyValueStorage {
  getItem: (key: string) => MaybePromise<string | null>;
  setItem: (key: string, value: string) => MaybePromise<void>;
  removeItem: (key: string) => MaybePromise<void>;
}

export interface KeyValueAuthStorageOptions {
  key?: string;
}

export interface BroadcastAuthSyncOptions {
  channelName?: string;
}

const DEFAULT_SYNC_CHANNEL_NAME = "convex-zen-auth";
const DEFAULT_STORAGE_KEY = "convex-zen.auth.token";

type BroadcastPayload = {
  source: string;
  signal: AuthSyncSignal;
};

function createSourceId(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}

function isAuthSyncSignal(value: unknown): value is AuthSyncSignal {
  return (
    value === "token-invalidated" ||
    value === "token-cleared" ||
    value === "signed-in" ||
    value === "signed-out"
  );
}

function isBroadcastPayload(value: unknown): value is BroadcastPayload {
  if (value === null || typeof value !== "object") {
    return false;
  }
  const payload = value as { source?: unknown; signal?: unknown };
  return (
    typeof payload.source === "string" && isAuthSyncSignal(payload.signal)
  );
}

function asError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  return new Error(
    typeof error === "string" ? error : "Unknown auth runtime error"
  );
}

export function createMemoryAuthStorage(): AuthRuntimeStorage {
  let payload: AuthTokenPayload | null = null;
  return {
    get: async () => payload,
    set: async (nextPayload) => {
      payload = nextPayload;
    },
    clear: async () => {
      payload = null;
    },
  };
}

function parseStoredPayload(raw: string): AuthTokenPayload | null {
  try {
    const parsed = JSON.parse(raw) as {
      token?: unknown;
      issuedAtMs?: unknown;
      expiresAtMs?: unknown;
    };
    const token = parsed.token;
    if (token !== null && typeof token !== "string") {
      return null;
    }
    const payload: AuthTokenPayload = {
      token: token ?? null,
    };
    if (typeof parsed.issuedAtMs === "number") {
      payload.issuedAtMs = parsed.issuedAtMs;
    }
    if (typeof parsed.expiresAtMs === "number") {
      payload.expiresAtMs = parsed.expiresAtMs;
    }
    return payload;
  } catch {
    return null;
  }
}

function serializePayload(payload: AuthTokenPayload): string {
  const serialized: {
    token: string | null;
    issuedAtMs?: number;
    expiresAtMs?: number;
  } = {
    token: payload.token ?? null,
  };
  if (payload.issuedAtMs !== undefined) {
    serialized.issuedAtMs = payload.issuedAtMs;
  }
  if (payload.expiresAtMs !== undefined) {
    serialized.expiresAtMs = payload.expiresAtMs;
  }
  return JSON.stringify(serialized);
}

export function createLocalStorageAuthStorage(
  options: LocalStorageAuthStorageOptions = {}
): AuthRuntimeStorage {
  const key = options.key ?? DEFAULT_STORAGE_KEY;
  const canUseStorage = () =>
    typeof window !== "undefined" &&
    typeof window.localStorage !== "undefined";

  return {
    get: async () => {
      if (!canUseStorage()) {
        return null;
      }
      const raw = window.localStorage.getItem(key);
      if (!raw) {
        return null;
      }
      return parseStoredPayload(raw);
    },
    set: async (payload) => {
      if (!canUseStorage()) {
        return;
      }
      if (!payload) {
        window.localStorage.removeItem(key);
        return;
      }
      window.localStorage.setItem(key, serializePayload(payload));
    },
    clear: async () => {
      if (!canUseStorage()) {
        return;
      }
      window.localStorage.removeItem(key);
    },
  };
}

export function createKeyValueStorageAuthStorage(
  storage: AuthKeyValueStorage,
  options: KeyValueAuthStorageOptions = {}
): AuthRuntimeStorage {
  const key = options.key ?? DEFAULT_STORAGE_KEY;

  return {
    get: async () => {
      const raw = await storage.getItem(key);
      if (!raw) {
        return null;
      }
      return parseStoredPayload(raw);
    },
    set: async (payload) => {
      if (!payload) {
        await storage.removeItem(key);
        return;
      }
      await storage.setItem(key, serializePayload(payload));
    },
    clear: async () => {
      await storage.removeItem(key);
    },
  };
}

export function createBroadcastAuthSync(
  options: BroadcastAuthSyncOptions = {}
): AuthRuntimeSync {
  const channelName = options.channelName ?? DEFAULT_SYNC_CHANNEL_NAME;
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") {
    return {
      publish: () => {},
      subscribe: () => () => {},
    };
  }
  const source = createSourceId();
  const channel = new BroadcastChannel(channelName);

  return {
    publish: (signal) => {
      channel.postMessage({
        source,
        signal,
      } satisfies BroadcastPayload);
    },
    subscribe: (listener) => {
      const onMessage = (event: MessageEvent<unknown>) => {
        if (!isBroadcastPayload(event.data)) {
          return;
        }
        if (event.data.source === source) {
          return;
        }
        listener(event.data.signal);
      };
      channel.addEventListener("message", onMessage);
      return () => {
        channel.removeEventListener("message", onMessage);
      };
    },
  };
}

export function createAuthRuntime(options: AuthRuntimeOptions): AuthRuntime {
  const now = options.now ?? (() => Date.now());
  const maxUnauthorizedRefreshRetries =
    options.maxUnauthorizedRefreshRetries ?? 1;
  const debugEnabled = options.debug === true;
  const storage = options.storage;
  const sync = options.sync;

  let state: AuthRuntimeState = {
    status: "anonymous",
    token: null,
  };
  const listeners = new Set<(event: AuthRuntimeEvent) => void>();
  const connectedConvexClients = new Set<ConvexAuthClientLike>();
  let applyingRemoteSignal = false;
  let hydrationPromise: Promise<void> | null = null;
  let hydrated = false;

  let pendingUnauthorizedRefresh = false;
  let unauthorizedRefreshAttempts = 0;
  let unauthorizedRetryExhausted = false;

  const emit = (event: AuthRuntimeEvent) => {
    for (const listener of listeners) {
      listener(event);
    }
  };

  const emitState = () => {
    emit({ type: "state", state: { ...state } });
  };

  const setState = (nextState: AuthRuntimeState) => {
    state = nextState;
    emitState();
  };

  const setStatus = (status: AuthStatus) => {
    if (state.status === status) {
      return;
    }
    setState({
      ...state,
      status,
    });
  };

  const reportError = (error: unknown) => {
    const runtimeError = asError(error);
    setState({
      ...state,
      lastError: runtimeError,
      status: state.token === null ? "anonymous" : "stale",
    });
    emit({ type: "error", error: runtimeError });
    if (debugEnabled) {
      console.warn("[convex-zen] auth runtime error", runtimeError);
    }
  };

  const tokenManager = createAuthTokenManager({
    fetchToken: async (requestOptions) =>
      options.tokenProvider.getToken(requestOptions),
    ...(options.now !== undefined ? { now: options.now } : {}),
    ...(options.refreshSkewMs !== undefined
      ? { refreshSkewMs: options.refreshSkewMs }
      : {}),
  });

  const persistPayload = (payload: AuthTokenPayload | null) => {
    if (!storage) {
      return;
    }
    const persistPromise =
      payload === null ? storage.clear() : storage.set(payload);
    void Promise.resolve(persistPromise).catch(reportError);
  };

  tokenManager.subscribe((event) => {
    if (event.type === "updated") {
      const payload: AuthTokenPayload = {
        token: event.token ?? null,
      };
      if (event.issuedAtMs !== undefined) {
        payload.issuedAtMs = event.issuedAtMs;
      }
      if (event.expiresAtMs !== undefined) {
        payload.expiresAtMs = event.expiresAtMs;
      }
      persistPayload(payload.token === null ? null : payload);
      const nextState: AuthRuntimeState = {
        status: payload.token ? "authenticated" : "anonymous",
        token: payload.token,
        lastRefreshAtMs: now(),
      };
      if (payload.issuedAtMs !== undefined) {
        nextState.issuedAtMs = payload.issuedAtMs;
      }
      if (payload.expiresAtMs !== undefined) {
        nextState.expiresAtMs = payload.expiresAtMs;
      }
      setState(nextState);
      emit({ type: "token", payload });
      return;
    }

    persistPayload(null);
    if (event.type === "invalidated") {
      setState({
        status: "stale",
        token: null,
      });
      if (event.reason !== undefined) {
        emit({ type: "invalidated", reason: event.reason });
      } else {
        emit({ type: "invalidated" });
      }
      return;
    }
    setState({
      status: "anonymous",
      token: null,
    });
  });

  const ensureHydrated = async (): Promise<void> => {
    if (hydrated || !storage) {
      hydrated = true;
      return;
    }
    if (hydrationPromise) {
      return hydrationPromise;
    }
    hydrationPromise = Promise.resolve(storage.get())
      .then((payload) => {
        if (payload) {
          tokenManager.prime(payload);
        }
        hydrated = true;
      })
      .catch((error) => {
        hydrated = true;
        reportError(error);
      })
      .finally(() => {
        hydrationPromise = null;
      });
    return hydrationPromise;
  };

  const publishSignal = (signal: AuthSyncSignal) => {
    if (!sync || applyingRemoteSignal) {
      return;
    }
    sync.publish(signal);
  };

  const reconnectConvexClients = () => {
    for (const convexClient of connectedConvexClients) {
      convexClient.clearAuth();
      convexClient.setAuth(readToken, onConvexAuthChange);
    }
  };

  const resetUnauthorizedRetryState = () => {
    pendingUnauthorizedRefresh = false;
    unauthorizedRefreshAttempts = 0;
    unauthorizedRetryExhausted = false;
  };

  const clearInternal = (publish = true) => {
    tokenManager.clear();
    reconnectConvexClients();
    if (publish) {
      publishSignal("token-cleared");
    }
  };

  const invalidateInternal = (reason?: string, publish = true) => {
    tokenManager.invalidate(reason);
    if (publish) {
      publishSignal("token-invalidated");
    }
  };

  const onUnauthorizedInternal = () => {
    if (unauthorizedRetryExhausted) {
      return;
    }
    if (
      pendingUnauthorizedRefresh ||
      unauthorizedRefreshAttempts >= maxUnauthorizedRefreshRetries
    ) {
      unauthorizedRetryExhausted = true;
      tokenManager.clear();
      publishSignal("token-cleared");
      return;
    }
    pendingUnauthorizedRefresh = true;
    invalidateInternal("unauthorized");
  };

  const onConvexAuthChange = (isAuthenticated: boolean) => {
    if (isAuthenticated) {
      resetUnauthorizedRetryState();
      return;
    }
    onUnauthorizedInternal();
  };

  const readToken = async (): Promise<string | null> => {
    return getToken();
  };

  if (sync) {
    sync.subscribe((signal) => {
      applyingRemoteSignal = true;
      try {
        if (signal === "signed-out" || signal === "token-cleared") {
          clearInternal(false);
          return;
        }
        invalidateInternal("remote-sync", false);
      } finally {
        applyingRemoteSignal = false;
      }
    });
  }

  const getTokenPayload = async (
    requestOptions?: { forceRefresh?: boolean }
  ): Promise<AuthTokenPayload> => {
    await ensureHydrated();
    if (unauthorizedRetryExhausted) {
      return { token: null };
    }
    const useForcedRefresh =
      requestOptions?.forceRefresh === true || pendingUnauthorizedRefresh;
    const usedUnauthorizedRetry = pendingUnauthorizedRefresh;
    if (useForcedRefresh) {
      setStatus("refreshing");
    } else if (state.token === null) {
      setStatus("authenticating");
    } else {
      setStatus("refreshing");
    }
    try {
      if (useForcedRefresh) {
        const payload = await tokenManager.getTokenPayload({ forceRefresh: true });
        if (usedUnauthorizedRetry) {
          unauthorizedRefreshAttempts += 1;
          if (payload.token === null) {
            unauthorizedRetryExhausted = true;
          }
        }
        return payload;
      }
      return tokenManager.getTokenPayload();
    } catch (error) {
      reportError(error);
      throw error;
    } finally {
      if (usedUnauthorizedRetry) {
        pendingUnauthorizedRefresh = false;
      }
    }
  };

  const getToken = async (
    requestOptions?: { forceRefresh?: boolean }
  ): Promise<string | null> => {
    const payload = await getTokenPayload(requestOptions);
    return payload.token;
  };

  const onSignedIn = async (): Promise<void> => {
    resetUnauthorizedRetryState();
    clearInternal(false);
    publishSignal("signed-in");
    emit({ type: "signed-in" });
  };

  const onSignedOut = async (): Promise<void> => {
    resetUnauthorizedRetryState();
    clearInternal(false);
    publishSignal("signed-out");
    emit({ type: "signed-out" });
  };

  const invalidate = async (reason?: string): Promise<void> => {
    invalidateInternal(reason);
  };

  const clear = async (): Promise<void> => {
    resetUnauthorizedRetryState();
    clearInternal(true);
  };

  const onUnauthorized = async (_error?: unknown): Promise<void> => {
    onUnauthorizedInternal();
  };

  const mountConvex = (client: ConvexAuthClientLike): (() => void) => {
    connectedConvexClients.add(client);
    client.setAuth(readToken, onConvexAuthChange);
    return () => {
      connectedConvexClients.delete(client);
      client.clearAuth();
    };
  };

  return {
    getState: () => ({ ...state }),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getToken,
    getTokenPayload,
    onSignedIn,
    onSignedOut,
    invalidate,
    clear,
    onUnauthorized,
    mountConvex,
  };
}
