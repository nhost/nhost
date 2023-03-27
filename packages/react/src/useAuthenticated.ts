import { useEffect, useState } from 'react'

import { useAuthInterpreter } from './useAuthInterpreter'

/**
 * Use `useAuthenticated` to get the authentication status of the user.
 *
 * @example
 * ```ts
 * const isAuthenticated = useAuthenticated();
 * ```
 *
 * @docs https://docs.nhost.io/reference/react/use-access-token
 */
export const useAuthenticated = (): boolean => {
  const service = useAuthInterpreter()
  const [isAuthenticated, setIsAuthenticated] = useState(
    !!service.status && service.getSnapshot().matches({ authentication: 'signedIn' })
  )
  useEffect(() => {
    const subscription = service.subscribe((state) => {
      const newValue = state.matches({ authentication: 'signedIn' })
      setIsAuthenticated(newValue)
    })
    return subscription.unsubscribe
  }, [service])
  return isAuthenticated
}
