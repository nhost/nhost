import { Navigate, useLocation } from 'react-router-dom'

import { useAuthenticationStatus, useUserIsAnonymous } from '@nhost/react'

const LoadingComponent: React.FC<React.PropsWithChildren<{ connectionAttempts: number }>> = ({
  connectionAttempts
}) => {
  if (connectionAttempts > 0) {
    return (
      <div>
        Could not sign in automatically. Retrying to get user information
        {Array(connectionAttempts).join('.')}
      </div>
    )
  }
  return <div>Loading...</div>
}

export const AuthGate: React.FC<React.PropsWithChildren<unknown>> = ({ children }) => {
  const { isLoading, isAuthenticated, connectionAttempts } = useAuthenticationStatus()

  const location = useLocation()

  if (isLoading) {
    return <LoadingComponent connectionAttempts={connectionAttempts} />
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
  const { isLoading, isAuthenticated, connectionAttempts } = useAuthenticationStatus()
  const isAnonymous = useUserIsAnonymous()
  const location = useLocation()
  if (isLoading) {
    return <LoadingComponent connectionAttempts={connectionAttempts} />
  }

  if (isAuthenticated && !anonymous && isAnonymous) {
    return <Navigate to={'/'} state={{ from: location }} replace />
  }

  return <div>{children}</div>
}
