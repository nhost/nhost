import { useAuthenticationStatus } from '@nhost/react'
import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'

export function RequireAuth({ children }: { children: JSX.Element }) {
  const { isAuthenticated, isLoading } = useAuthenticationStatus()

  const location = useLocation()

  if (isLoading) {
    return <div>Loading user data...</div>
  }

  if (!isAuthenticated) {
    return <Navigate to="/sign-in" state={{ from: location }} />
  }

  return children
}
