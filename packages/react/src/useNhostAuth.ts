import { User } from '@nhost/nhost-js'
import { useMemo } from 'react'

import { useAuthenticationStatus } from './useAuthenticationStatus'
import { useUserData } from './useUserData'

/**
 * @deprecated
 * This hook ensures backward compatibility with `@nhost/react-auth`, which is deprecated.
 */
export const useNhostAuth = (): {
  isLoading: boolean
  isAuthenticated: boolean
  user: User | null
} => {
  const { isLoading, isAuthenticated } = useAuthenticationStatus()
  const user = useUserData()
  return useMemo(() => ({ isLoading, isAuthenticated, user }), [isLoading, isAuthenticated, user])
}
