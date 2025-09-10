import { useAuth } from "../lib/nhost/AuthProvider";

export default function Home() {
  const { isAuthenticated, user } = useAuth();

  return (
    <div>
      <h1>Welcome to Nhost React Demo</h1>

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
