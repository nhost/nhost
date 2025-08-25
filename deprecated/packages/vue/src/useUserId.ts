import { useSelector } from '@xstate/vue'
import { Ref } from 'vue'

import { useAuthInterpreter } from './useAuthInterpreter'

/**
 * Use the composable `useUserId` to get the id of the user.
 *
 * @example
 * ```tsx
 * const userId = useUserId();
 * ```
 *
 * @docs https://docs.nhost.io/reference/vue/use-user-id
 */
export const useUserId = (): Ref<string | undefined> => {
  const service = useAuthInterpreter()
  return useSelector(
    service.value,
    (state) => state.context.user?.id,
    (a, b) => a === b
  )
}
