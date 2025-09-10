import { useAuth } from "../lib/nhost/AuthProvider";

export default function Profile() {
  const { user, session } = useAuth();

  return (
    <div className="todos-container">
      <header className="todos-header">
        <h1 className="todos-title">Your Profile</h1>
      </header>

      <div className="todo-form-card">
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
            <span style={{
              color: user?.emailVerified ? '#10b981' : '#ef4444',
              fontWeight: 'bold',
              marginLeft: '0.5rem'
            }}>
              {user?.emailVerified ? "✓ Yes" : "✗ No"}
            </span>
          </div>
        </div>
      </div>

      <div className="todo-form-card">
        <h3 className="form-title">Session Information</h3>
        <div className="todo-description">
          <pre style={{ 
            fontSize: '0.75rem', 
            overflow: 'auto', 
            margin: 0,
            lineHeight: 1.4,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word'
          }}>
            {JSON.stringify(session, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}
