import { Link } from "react-router-dom";
import { useAuth } from "../lib/nhost/AuthProvider";

export default function Home() {
  const { isAuthenticated, user } = useAuth();

  return (
    <div>
      <h1>Welcome to Nhost Todos App</h1>

      {isAuthenticated ? (
        <div>
          <p>Hello, {user?.displayName || user?.email}!</p>
          <div style={{ marginTop: '1rem' }}>
            <p>
              <Link to="/todos" style={{ marginRight: '1rem' }}>Manage Todos</Link>
              <Link to="/profile">Your Profile</Link>
            </p>
          </div>
        </div>
      ) : (
        <div>
          <p>You are not signed in.</p>
          <div style={{ marginTop: '1rem' }}>
            <p>
              <Link to="/signin" style={{ marginRight: '1rem' }}>Sign In</Link>
              or
              <Link to="/signup" style={{ marginLeft: '1rem' }}>Sign Up</Link>
            </p>
          </div>
          <p style={{ marginTop: '1rem', fontSize: '0.9rem', color: '#666' }}>
            Sign in to access your personal todos and manage your tasks.
          </p>
        </div>
      )}
    </div>
  );
}
