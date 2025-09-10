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
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '200px'
      }}>
        <p>Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to={redirectTo} />;
  }

  return <Outlet />;
}
