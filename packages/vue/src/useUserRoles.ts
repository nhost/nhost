import { useSelector } from '@xstate/vue'

import { useAuthInterpreter } from './useAuthInterpreter'

/**
 * Composable to get the current user's roles.
 *
 * @example
 * ```ts
 * const roles = useUserRoles()
 * ```
 *
 * @returns `Ref` to the roles of the current user
 */
export const useUserRoles = () => {
  const service = useAuthInterpreter()
  return useSelector(
    service.value,
    (state) => state.context.user?.roles || [],
    (a, b) => a.every((i) => b.includes(i) && b.every((i) => a.includes(i)))
  )
}
