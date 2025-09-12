import { createNhostClient } from "../../lib/nhost/server";

export default async function Profile() {
  // Create the client with async cookie access
  const nhost = await createNhostClient();
  const session = nhost.getUserSession();

  // At this point, middleware has ensured we have a session

  return (
    <div className="container">
      <header className="page-header">
        <h1 className="page-title">Your Profile</h1>
      </header>

      <div className="form-card">
        <h3 className="form-title">User Information</h3>
        <div className="form-fields">
          <div className="field-group">
            <strong>Display Name:</strong> {session?.user?.displayName || "Not set"}
          </div>
          <div className="field-group">
            <strong>Email:</strong> {session?.user?.email || "Not available"}
          </div>
          <div className="field-group">
            <strong>User ID:</strong> {session?.user?.id || "Not available"}
          </div>
          <div className="field-group">
            <strong>Roles:</strong> {session?.user?.roles?.join(", ") || "None"}
          </div>
          <div className="field-group">
            <strong>Email Verified:</strong>
            <span className={session?.user?.emailVerified ? 'email-verified' : 'email-unverified'}>
              {session?.user?.emailVerified ? "✓ Yes" : "✗ No"}
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
