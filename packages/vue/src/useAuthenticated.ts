import { useSelector } from '@xstate/vue'

import { useAuthInterpreter } from './useAuthInterpreter'

/**
 * Gets the authentication status as a `Ref`, either `true` when authenticated, or `false` when not authenticated or when the Nhost client is still loading.
 */
export const useAuthenticated = () => {
  const service = useAuthInterpreter()
  return useSelector(service.value, (state) => state.matches({ authentication: 'signedIn' }))
}
