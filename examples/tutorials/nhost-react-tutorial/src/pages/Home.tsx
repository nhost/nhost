import { useAuth } from '../lib/nhost/AuthProvider';

export default function Home() {
  const { isAuthenticated, user } = useAuth();

  return (
    <div className="container">
      <header className="page-header">
        <h1 className="page-title">Welcome to Nhost React Demo</h1>
      </header>

      {isAuthenticated ? (
        <div>
          <p>Hello, {user?.displayName || user?.email}!</p>
        </div>
      ) : (
        <div>
          <p>You are not signed in.</p>
        </div>
      )}
    </div>
  );
}
