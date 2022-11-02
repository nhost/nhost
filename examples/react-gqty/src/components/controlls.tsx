import React from 'react'

import { useAuthenticationStatus } from '@nhost/react'

export const SignedIn = ({ children }: React.PropsWithChildren<unknown>): JSX.Element | null => {
  const { isAuthenticated, isLoading } = useAuthenticationStatus()

  if (isLoading) {
    return <div>Loading...</div>
  }

  if (isAuthenticated) {
    return <>{children}</>
  }
  return null
}

export const SignedOut = ({ children }: React.PropsWithChildren<unknown>): JSX.Element | null => {
  const { isAuthenticated, isLoading } = useAuthenticationStatus()

  if (isLoading) {
    return null
  }

  if (!isAuthenticated) {
    return <>{children}</>
  }
  return null
}
