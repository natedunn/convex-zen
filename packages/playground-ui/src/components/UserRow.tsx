import { StatusTag } from "./StatusTag";

export type UserRowData = {
  _id: string;
  email: string;
  name?: string;
  emailVerified: boolean;
  role?: string;
  banned?: boolean;
  banReason?: string;
};

export function UserRow({
  user,
  onBan,
  onUnban,
  onSetRole,
}: {
  user: UserRowData;
  onBan?: (userId: string) => void;
  onUnban?: (userId: string) => void;
  onSetRole?: (userId: string) => void;
}) {
  return (
    <div className="card">
      <div className="user-row">
        <div>
          <strong>{user.email}</strong>
          {user.name && <span className="muted"> ({user.name})</span>}
          <div className="session-detail">
            <code>{user._id}</code>
          </div>
        </div>
        <div className="user-row-tags">
          {user.emailVerified ? (
            <StatusTag variant="success">verified</StatusTag>
          ) : (
            <StatusTag variant="neutral">unverified</StatusTag>
          )}
          {user.role && <StatusTag variant="neutral">{user.role}</StatusTag>}
          {user.banned && <StatusTag variant="danger">banned</StatusTag>}
        </div>
      </div>

      <div className="user-row-actions">
        {!user.banned && onBan && (
          <button className="btn-danger" onClick={() => onBan(user._id)}>
            Ban
          </button>
        )}
        {user.banned && onUnban && (
          <button className="btn-secondary" onClick={() => onUnban(user._id)}>
            Unban
          </button>
        )}
        {onSetRole && (
          <button className="btn-secondary" onClick={() => onSetRole(user._id)}>
            Set role
          </button>
        )}
      </div>

      {user.banReason && <p className="ban-reason">Ban reason: {user.banReason}</p>}
    </div>
  );
}
