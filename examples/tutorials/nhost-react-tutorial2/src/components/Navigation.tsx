import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/nhost/AuthProvider";

export default function Navigation() {
  const { isAuthenticated, session, nhost } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      if (session) {
        await nhost.auth.signOut({
          refreshToken: session.refreshToken,
        });
      }
      navigate("/");
    } catch (err: any) {
      console.error("Error signing out:", err);
    }
  };

  return (
    <nav className="navigation">
      <div className="nav-container">
        <Link to="/" className="nav-logo">
          Nhost React Demo
        </Link>

        <div className="nav-links">
          <Link to="/" className="nav-link">
            Home
          </Link>

          {isAuthenticated ? (
            <>
              <Link to="/todos" className="nav-link">
                Todos
              </Link>
              <Link to="/profile" className="nav-link">
                Profile
              </Link>
              <button
                onClick={handleSignOut}
                className="nav-link nav-button"
              >
                Sign Out
              </button>
            </>
          ) : (
            <>
              <Link to="/signin" className="nav-link">
                Sign In
              </Link>
              <Link to="/signup" className="nav-link">
                Sign Up
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
