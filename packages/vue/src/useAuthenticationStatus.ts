import { computed } from 'vue'

import { useSelector } from '@xstate/vue'

import { useAuthInterpreter } from './useAuthInterpreter'

/**
 * The Nhost client may need some initial steps to determine the authentication status during startup, like fetching a new JWT from an existing refresh token.
 * @return `isLoading` will return `true` until the authentication status is known.
 *
 * `        isAuthenticated` returns `true` if the user is authenticated, `false` if not or if the client is still determining the status.
 */
export const useAuthenticationStatus = () => {
  const service = useAuthInterpreter()
  // TODO review this
  const status = useSelector(
    service.value,
    (state) => ({
      isAuthenticated: state.matches({ authentication: 'signedIn' }),
      isLoading: !state.hasTag('ready')
    }),
    (a, b) => a.isAuthenticated === b.isAuthenticated && a.isLoading === b.isLoading
  )
  return {
    isAuthenticated: computed(() => status.value.isAuthenticated),
    isLoading: computed(() => status.value.isLoading)
  }
}
