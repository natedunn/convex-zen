/**
 * Framework-agnostic auth/session primitives.
 *
 * These helpers keep auth flow logic in one place so framework adapters
 * (TanStack Start, Next.js, etc.) can stay thin.
 */

export interface SessionInfo {
  userId: string;
  sessionId: string;
}

export interface SignInInput {
  email: string;
  password: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface SignInOutput {
  sessionToken: string;
  userId: string;
}

export interface SessionTransport {
  signIn: (input: SignInInput) => Promise<SignInOutput>;
  validateSession: (token: string) => Promise<SessionInfo | null>;
  signOut: (token: string) => Promise<void>;
}

export interface EstablishedSession {
  sessionToken: string;
  session: SessionInfo;
}

/**
 * Shared auth/session operations that can be reused by all framework adapters.
 */
export class SessionPrimitives {
  constructor(private readonly transport: SessionTransport) {}

  /**
   * Resolve session details from a raw token.
   */
  async getSessionFromToken(
    token: string | null | undefined
  ): Promise<SessionInfo | null> {
    if (!token) {
      return null;
    }
    return this.transport.validateSession(token);
  }

  /**
   * Resolve and require a valid session from a raw token.
   * Throws "Unauthorized" if missing/invalid.
   */
  async requireSessionFromToken(token: string | null | undefined) {
    const session = await this.getSessionFromToken(token);
    if (!session) {
      throw new Error("Unauthorized");
    }
    return session;
  }

  /**
   * Sign in and immediately verify the returned token.
   * This mirrors common auth library behavior where sign-in returns a token,
   * and the framework layer then stores the token in a cookie.
   */
  async signInAndResolveSession(
    input: SignInInput
  ): Promise<EstablishedSession> {
    const result = await this.transport.signIn(input);
    const session = await this.transport.validateSession(result.sessionToken);

    if (!session) {
      throw new Error("Could not validate newly created session");
    }

    return {
      sessionToken: result.sessionToken,
      session,
    };
  }

  /**
   * Best-effort sign out by token.
   */
  async signOutByToken(token: string | null | undefined): Promise<void> {
    if (!token) {
      return;
    }
    await this.transport.signOut(token);
  }
}

export function createSessionPrimitives(transport: SessionTransport) {
  return new SessionPrimitives(transport);
}
