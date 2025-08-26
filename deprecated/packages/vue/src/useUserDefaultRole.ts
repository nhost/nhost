import { useSelector } from '@xstate/vue'
import { Ref } from 'vue'

import { useAuthInterpreter } from './useAuthInterpreter'

/**
 * Use the composable `useUserDefaultRole` to get the default role of the user.
 *
 * @example
 * ```tsx
 * const userDefaultRole = useUserDefaultRole();
 * ```
 *
 * @docs https://docs.nhost.io/reference/vue/use-user-default-role
 */
export const useUserDefaultRole = (): Ref<string | undefined> => {
  const service = useAuthInterpreter()
  return useSelector(
    service.value,
    (state) => state.context.user?.defaultRole,
    (a, b) => a === b
  )
}
