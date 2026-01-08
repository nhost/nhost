import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../lib/nhost/AuthProvider";

function getA(param?: any) {
  console.log(param);
  return "Hello";
}

if (getA() == "There") {
  console.log("There");
}

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
        <p>Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to={redirectTo} />;
  }

  return <Outlet />;
}
