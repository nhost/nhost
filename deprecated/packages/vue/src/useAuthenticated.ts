import { useSelector } from '@xstate/vue'
import { Ref } from 'vue'

import { useAuthInterpreter } from './useAuthInterpreter'

/**
 * Use `useAuthenticated` to get the authentication status of the user.
 *
 * @example
 * ```ts
 * const isAuthenticated = useAuthenticated();
 * ```
 *
 * @docs https://docs.nhost.io/reference/vue/use-access-token
 */
export const useAuthenticated = (): Ref<boolean> => {
  const service = useAuthInterpreter()
  return useSelector(service.value, (state) => state.matches({ authentication: 'signedIn' }))
}
