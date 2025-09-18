import { useAuth } from "../lib/nhost/AuthProvider";

export default function Profile() {
  const { user, session } = useAuth();

  return (
    <div className="container">
      <header className="page-header">
        <h1 className="page-title">Your Profile</h1>
      </header>

      <div className="form-card">
        <h3 className="form-title">User Information</h3>
        <div className="form-fields">
          <div className="field-group">
            <strong>Display Name:</strong> {user?.displayName || "Not set"}
          </div>
          <div className="field-group">
            <strong>Email:</strong> {user?.email || "Not available"}
          </div>
          <div className="field-group">
            <strong>User ID:</strong> {user?.id || "Not available"}
          </div>
          <div className="field-group">
            <strong>Roles:</strong> {user?.roles?.join(", ") || "None"}
          </div>
          <div className="field-group">
            <strong>Email Verified:</strong>
            <span
              className={
                user?.emailVerified ? "email-verified" : "email-unverified"
              }
            >
              {user?.emailVerified ? "✓ Yes" : "✗ No"}
            </span>
          </div>
        </div>
      </div>

      <div className="form-card">
        <h3 className="form-title">Session Information</h3>
        <div className="description">
          <pre className="session-display">
            {JSON.stringify(session, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}
