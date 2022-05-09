import { toRefs } from '@vueuse/core'
import { useSelector } from '@xstate/vue'

import { useAuthInterpreter } from './useAuthInterpreter'

/**
 * The Nhost client may need some initial steps to determine the authentication status during startup, like fetching a new JWT from an existing refresh token.
 */
export const useAuthenticationStatus = () => {
  const service = useAuthInterpreter()
  return toRefs(
    useSelector(
      service.value,
      (state) => ({
        isAuthenticated: state.matches({ authentication: 'signedIn' }),
        isLoading: state.hasTag('loading'),
        error: state.context.errors.authentication || null,
        isError: state.matches({ authentication: { signedOut: 'failed' } })
      }),
      (a, b) => a.isAuthenticated === b.isAuthenticated && a.isLoading === b.isLoading
    )
  )
}
