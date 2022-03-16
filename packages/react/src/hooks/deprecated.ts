import { useMemo } from 'react'

import { useAuthenticated, useAuthLoading } from './common'
import { useUserData } from './user'

/**
 * @deprecated This hooks ensures backward compatibility with `@nhost/react-auth`, which is deprecated
 */
export const useNhostAuth = () => {
    const isLoading = useAuthLoading()
    const isAuthenticated = useAuthenticated()
    const user = useUserData()
    return useMemo(() =>({isLoading, isAuthenticated, user}), [isLoading, isAuthenticated, user])
  }
  