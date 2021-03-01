import React from "react";
import { Redirect } from "react-router-dom";
import { useAuth } from "@nhost/react-auth";

export function AuthGate({ children }) {
  const { signedIn } = useAuth();

  if (signedIn === null) {
    return <div>Loading...</div>;
  }

  if (!signedIn) {
    return <Redirect to="/login" />;
  }

  // user is logged in
  return children;
}
