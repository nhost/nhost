import { useSelector } from '@xstate/vue'

import { useAuthInterpreter } from './useAuthInterpreter'

/**
 * Use the composable `useUserRoles` to get all allowed roles of the current user.
 *
 * @example
 * ```tsx
 * const userRoles = useUserRoles();
 * ```
 *
 * @docs https://docs.nhost.io/reference/vue/use-user-roles
 */
export const useUserRoles = () => {
  const service = useAuthInterpreter()
  return useSelector(
    service.value,
    (state) => state.context.user?.roles || [],
    (a, b) => a.every((i) => b.includes(i) && b.every((i) => a.includes(i)))
  )
}
