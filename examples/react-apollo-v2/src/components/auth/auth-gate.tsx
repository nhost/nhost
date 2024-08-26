import { useAuthenticationStatus } from '@nhost/react'
import { LoaderCircle } from 'lucide-react'
import { FC, PropsWithChildren } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

export const AuthGate: FC<PropsWithChildren<unknown>> = ({ children }) => {
  const location = useLocation()
  const { isLoading, isAuthenticated } = useAuthenticationStatus()

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <LoaderCircle className="w-10 h-10 animate-spin-fast text-slate-500" />
        <span className="max-w-md text-center">
          Could not sign in automatically. Retrying to get user information
        </span>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/sign-in" state={{ from: location }} replace />
  }

  return <>{children}</>
}
