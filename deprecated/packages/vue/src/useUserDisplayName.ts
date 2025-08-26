import { useSelector } from '@xstate/vue'
import { Ref } from 'vue'

import { useAuthInterpreter } from './useAuthInterpreter'

/**
 * Use the composable `useUserDisplayName` to get the display name of the user.
 *
 * @example
 * ```tsx
 * const userDisplayName = useUserDisplayName();
 * ```
 *
 * @docs https://docs.nhost.io/reference/vue/use-user-display-name
 */
export const useUserDisplayName = (): Ref<string | undefined> => {
  const service = useAuthInterpreter()
  return useSelector(
    service.value,
    (state) => state.context.user?.displayName,
    (a, b) => a === b
  )
}
