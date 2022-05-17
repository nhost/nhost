import { useSelector } from '@xstate/vue'

import { useAuthInterpreter } from './useAuthInterpreter'

/**
 * Use the composable `useUserDisplayName` to get the display name of the current user.
 *
 * @example
 * ```tsx
 * const userDisplayName = useUserDisplayName();
 * ```
 *
 * @docs https://docs.nhost.io/reference/vue/use-user-display-name
 */
export const useUserDisplayName = () => {
  const service = useAuthInterpreter()
  return useSelector(
    service.value,
    (state) => state.context.user?.displayName,
    (a, b) => a === b
  )
}
