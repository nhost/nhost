import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../lib/nhost/AuthProvider";

interface ProtectedRouteProps {
  redirectTo?: string;
}

export default function ProtectedRoute({
  redirectTo = "/signin",
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="loading-content">
          <div className="spinner"></div>
          <span className="loading-text">Loading...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to={redirectTo} />;
  }

  return <Outlet />;
}
