import { useSelector } from '@xstate/vue'
import { Ref } from 'vue'

import { useAuthInterpreter } from './useAuthInterpreter'

/**
 * Use the composable `useUserRoles` to get all allowed roles of the user.
 *
 * @example
 * ```tsx
 * const userRoles = useUserRoles();
 * ```
 *
 * @docs https://docs.nhost.io/reference/vue/use-user-roles
 */
export const useUserRoles = (): Ref<string[]> => {
  const service = useAuthInterpreter()
  return useSelector(service.value, (state) => {
    if (!state.matches('authentication.signedIn')) {
      return []
    }
    return state.context.user?.roles || []
  })
}
