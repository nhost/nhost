import { Navigate, useLocation } from 'react-router-dom'

import { useAuthenticationStatus } from '@nhost/react'
import { useUserIsAnonymous } from '@nhost/react'

export const AuthGate: React.FC<React.PropsWithChildren<unknown>> = ({ children }) => {
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

export const PublicGate: React.FC<
  React.PropsWithChildren<{
    /** Set to `true` if you want this route to be accessible to anonymous users */
    anonymous?: boolean
  }>
> = ({ anonymous, children }) => {
  const { isLoading, isAuthenticated } = useAuthenticationStatus()
  const isAnonymous = useUserIsAnonymous()
  const location = useLocation()
  if (isLoading) {
    return <div>Loading...</div>
  }

  if (isAuthenticated && !anonymous && isAnonymous) {
    return <Navigate to={'/'} state={{ from: location }} replace />
  }

  return <div>{children}</div>
}
