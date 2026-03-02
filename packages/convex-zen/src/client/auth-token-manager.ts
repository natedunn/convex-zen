export interface AuthTokenPayload {
  token: string | null;
  issuedAtMs?: number;
  expiresAtMs?: number;
}

export interface AuthTokenManagerGetTokenOptions {
  forceRefresh?: boolean;
}

export type AuthTokenManagerListener = (
  event:
    | {
        type: "updated";
        token: string | null;
        issuedAtMs?: number;
        expiresAtMs?: number;
      }
    | { type: "invalidated"; reason?: string }
    | { type: "cleared" }
) => void;

export interface AuthTokenManagerOptions {
  fetchToken: (
    options?: AuthTokenManagerGetTokenOptions
  ) => Promise<AuthTokenPayload>;
  now?: () => number;
  refreshSkewMs?: number;
}

export interface AuthTokenManager {
  getToken: (
    options?: AuthTokenManagerGetTokenOptions
  ) => Promise<string | null>;
  getTokenPayload: (
    options?: AuthTokenManagerGetTokenOptions
  ) => Promise<AuthTokenPayload>;
  clear: () => void;
  invalidate: (reason?: string) => void;
  prime: (payload: AuthTokenPayload | null) => void;
  subscribe: (listener: AuthTokenManagerListener) => () => void;
}

const DEFAULT_REFRESH_SKEW_MS = 30_000;

function normalizePayload(payload: AuthTokenPayload): AuthTokenPayload {
  const normalized: AuthTokenPayload = {
    token: payload.token ?? null,
  };
  if (payload.issuedAtMs !== undefined) {
    normalized.issuedAtMs = payload.issuedAtMs;
  }
  if (payload.expiresAtMs !== undefined) {
    normalized.expiresAtMs = payload.expiresAtMs;
  }
  return normalized;
}

function shouldRefresh(
  payload: AuthTokenPayload | undefined,
  nowMs: number,
  refreshSkewMs: number
): boolean {
  if (!payload) {
    return true;
  }
  if (payload.expiresAtMs === undefined) {
    return false;
  }
  return payload.expiresAtMs <= nowMs + refreshSkewMs;
}

export function createAuthTokenManager(
  options: AuthTokenManagerOptions
): AuthTokenManager {
  const now = options.now ?? (() => Date.now());
  const refreshSkewMs = options.refreshSkewMs ?? DEFAULT_REFRESH_SKEW_MS;

  let cachedPayload: AuthTokenPayload | undefined = undefined;
  let inFlightFetch: Promise<AuthTokenPayload> | null = null;
  const listeners = new Set<AuthTokenManagerListener>();

  const emit = (
    event:
      | {
          type: "updated";
          token: string | null;
          issuedAtMs?: number;
          expiresAtMs?: number;
        }
      | { type: "invalidated"; reason?: string }
      | { type: "cleared" }
  ) => {
    for (const listener of listeners) {
      listener(event);
    }
  };

  const fetchAndCache = async (
    requestOptions?: AuthTokenManagerGetTokenOptions
  ): Promise<AuthTokenPayload> => {
    const fetched = normalizePayload(await options.fetchToken(requestOptions));
    cachedPayload = fetched;
    const updateEvent: {
      type: "updated";
      token: string | null;
      issuedAtMs?: number;
      expiresAtMs?: number;
    } = {
      type: "updated",
      token: fetched.token,
    };
    if (fetched.issuedAtMs !== undefined) {
      updateEvent.issuedAtMs = fetched.issuedAtMs;
    }
    if (fetched.expiresAtMs !== undefined) {
      updateEvent.expiresAtMs = fetched.expiresAtMs;
    }
    emit(updateEvent);
    return fetched;
  };

  const getTokenPayload = async (
    requestOptions?: AuthTokenManagerGetTokenOptions
  ): Promise<AuthTokenPayload> => {
    const forceRefresh = requestOptions?.forceRefresh === true;
    if (!forceRefresh && !shouldRefresh(cachedPayload, now(), refreshSkewMs)) {
      return cachedPayload as AuthTokenPayload;
    }

    if (!forceRefresh && inFlightFetch) {
      return inFlightFetch;
    }

    const fetchPromise = fetchAndCache(requestOptions).finally(() => {
      if (inFlightFetch === fetchPromise) {
        inFlightFetch = null;
      }
    });
    inFlightFetch = fetchPromise;
    return fetchPromise;
  };

  return {
    getToken: async (requestOptions) => {
      const payload = await getTokenPayload(requestOptions);
      return payload.token;
    },
    getTokenPayload,
    clear: () => {
      cachedPayload = undefined;
      inFlightFetch = null;
      emit({ type: "cleared" });
    },
    invalidate: (reason?: string) => {
      cachedPayload = undefined;
      if (reason !== undefined) {
        emit({ type: "invalidated", reason });
        return;
      }
      emit({ type: "invalidated" });
    },
    prime: (payload) => {
      inFlightFetch = null;
      if (payload === null) {
        cachedPayload = undefined;
        emit({ type: "cleared" });
        return;
      }
      const normalized = normalizePayload(payload);
      cachedPayload = normalized;
      const updateEvent: {
        type: "updated";
        token: string | null;
        issuedAtMs?: number;
        expiresAtMs?: number;
      } = {
        type: "updated",
        token: normalized.token,
      };
      if (normalized.issuedAtMs !== undefined) {
        updateEvent.issuedAtMs = normalized.issuedAtMs;
      }
      if (normalized.expiresAtMs !== undefined) {
        updateEvent.expiresAtMs = normalized.expiresAtMs;
      }
      emit(updateEvent);
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
