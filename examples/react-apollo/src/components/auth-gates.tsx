import { Navigate, useLocation } from 'react-router-dom'
import { useAuthenticated, useLoading } from '@nhost/react'

export const AuthGate: React.FC = ({ children }) => {
  const isAuthenticated = useAuthenticated()
  const isLoading = useLoading()
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
  const isAuthenticated = useAuthenticated()
  const isLoading = useLoading()
  const location = useLocation()
  if (isLoading) {
    return <div>Loading...</div>
  }

  if (isAuthenticated) {
    // ? stay on the same route - is it the best way to do so?
    return <Navigate to={location} state={{ from: location }} replace />
  }

  return <div>{children}</div>
}
