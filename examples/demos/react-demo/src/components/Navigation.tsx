import type { JSX } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../lib/nhost/AuthProvider";

export default function Navigation(): JSX.Element {
  const { isAuthenticated, nhost, session } = useAuth();
  const location = useLocation();

  // Helper function to determine if a link is active
  const isActive = (path: string): string => {
    return location.pathname === path ? "active" : "";
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <div className="flex items-center">
          <span className="navbar-brand">Nhost Demo</span>
          <div className="navbar-links">
            {isAuthenticated ? (
              <>
                <Link
                  to="/profile"
                  className={`nav-link ${isActive("/profile")}`}
                >
                  Profile
                </Link>
                <Link
                  to="/upload"
                  className={`nav-link ${isActive("/upload")}`}
                >
                  Upload
                </Link>
              </>
            ) : (
              <>
                <Link
                  to="/signin"
                  className={`nav-link ${isActive("/signin")}`}
                >
                  Sign In
                </Link>
                <Link
                  to="/signup"
                  className={`nav-link ${isActive("/signup")}`}
                >
                  Sign Up
                </Link>
              </>
            )}
          </div>
        </div>

        {isAuthenticated && (
          <div>
            <button
              type="button"
              onClick={async () => {
                if (session) {
                  await nhost.auth.signOut({
                    refreshToken: session.refreshToken,
                  });
                }
              }}
              className="icon-button"
              title="Sign Out"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                role="img"
                aria-label="Sign out"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
