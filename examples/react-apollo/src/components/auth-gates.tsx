import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import { useAuthenticationStatus } from '@nhost/react'

export const AuthGate: React.FC = ({ children }) => {
  const { isLoading, isAuthenticated } = useAuthenticationStatus()
  const location = useLocation()
  if (isLoading) {
    return <div>Loading...</div>
  }

  if (!isAuthenticated) {
    return <Navigate to="/sign-in" state={{ from: location }} replace />
  }

  return <div>{children}</div>
}

export const PublicGate: React.FC = ({ children }) => {
  const { isLoading, isAuthenticated } = useAuthenticationStatus()
  const location = useLocation()
  if (isLoading) {
    return <div>Loading...</div>
  }

  if (isAuthenticated) {
    return <Navigate to={'/'} state={{ from: location }} replace />
  }

  return <div>{children}</div>
}
