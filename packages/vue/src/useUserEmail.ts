import { useSelector } from '@xstate/vue'

import { useAuthInterpreter } from './useAuthInterpreter'

/**
 * Use the composbale `useUserEmail` to get the email of the current user.
 *
 * @example
 * ```tsx
 * const userEmail = useUserEmail();
 * ```
 *
 * @docs https://docs.nhost.io/reference/vue/use-user-email
 */
export const useUserEmail = () => {
  const service = useAuthInterpreter()
  return useSelector(
    service.value,
    (state) => state.context.user?.email,
    (a, b) => a === b
  )
}
