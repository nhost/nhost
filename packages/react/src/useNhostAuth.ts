import { useMemo } from 'react'

import { useAuthenticationStatus } from './useAuthenticationStatus'
import { useUserData } from './useUserData'

/**
 * @internal
 * @deprecated
 * This hook ensures backward compatibility with `@nhost/react-auth`, which is deprecated.
 */
export const useNhostAuth = () => {
  const { isLoading, isAuthenticated } = useAuthenticationStatus()
  const user = useUserData()
  return useMemo(() => ({ isLoading, isAuthenticated, user }), [isLoading, isAuthenticated, user])
}
