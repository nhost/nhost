import { useAuthenticationStatus } from '@nhost/react'
import { Navigate, useLocation } from 'react-router'
import { nhost } from '../utils/nhost'

export function RequireAuth({ children }: { children: JSX.Element }) {
  const { isAuthenticated, isLoading } = useAuthenticationStatus()

  console.log({ isAuthenticated, isLoading })

  console.log(nhost.auth.getUser())

  const location = useLocation()

  if (isLoading) {
    return <div>Loading user data...</div>
  }

  if (!isAuthenticated) {
    return <Navigate to="/sign-in" state={{ from: location }} />
  }

  return children
}
