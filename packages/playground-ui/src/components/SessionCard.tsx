import { StatusTag } from "./StatusTag";

export function SessionCard({
  userId,
  sessionId,
  email,
  onSignOut,
  onRefresh,
  signingOut,
}: {
  userId: string;
  sessionId: string;
  email?: string;
  onSignOut?: () => void;
  onRefresh?: () => void;
  signingOut?: boolean;
}) {
  return (
    <div className="card">
      <p className="section-label">Session</p>
      <p>
        <StatusTag variant="success">Active</StatusTag>
      </p>
      <p className="session-detail">
        User ID: <code>{userId}</code>
      </p>
      <p className="session-detail">
        Session ID: <code>{sessionId}</code>
      </p>
      {email && (
        <p className="session-detail">
          Email: <code>{email}</code>
        </p>
      )}
      {(onRefresh || onSignOut) && (
        <div className="actions">
          {onRefresh && (
            <button className="btn-secondary" type="button" onClick={onRefresh}>
              Refresh
            </button>
          )}
          {onSignOut && (
            <button
              className="btn-danger"
              type="button"
              disabled={signingOut}
              onClick={onSignOut}
            >
              {signingOut ? "Signing out..." : "Sign Out"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
