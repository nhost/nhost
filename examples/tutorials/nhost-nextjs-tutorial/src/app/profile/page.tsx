import { createNhostClient } from "../../lib/nhost/server";

export default async function Profile() {
  // Create the client with async cookie access
  const nhost = await createNhostClient();
  const session = nhost.getUserSession();

  // At this point, middleware has ensured we have a session

  return (
    <div className="container">
      <header>
        <h1>Your Profile</h1>
      </header>

      <div className="profile-section">
        <h3>User Information</h3>
        <div className="user-info">
          <div className="info-item">
            <strong>Display Name:</strong>
            <span>{session?.user?.displayName || "Not set"}</span>
          </div>
          <div className="info-item">
            <strong>Email:</strong>
            <span>{session?.user?.email || "Not available"}</span>
          </div>
          <div className="info-item">
            <strong>User ID:</strong>
            <span className="user-id">{session?.user?.id || "Not available"}</span>
          </div>
          <div className="info-item">
            <strong>Roles:</strong>
            <span>{session?.user?.roles?.join(", ") || "None"}</span>
          </div>
          <div className="info-item">
            <strong>Email Verified:</strong>
            <span className={session?.user?.emailVerified ? 'verified' : 'unverified'}>
              {session?.user?.emailVerified ? "✓ Yes" : "✗ No"}
            </span>
          </div>
        </div>
      </div>

      <div className="session-section">
        <h3>Session Information</h3>
        <pre className="session-data">
          {JSON.stringify(session, null, 2)}
        </pre>
      </div>
    </div>
  );
}
