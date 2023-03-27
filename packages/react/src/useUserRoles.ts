import { useSelector } from '@xstate/react'

import { useAuthInterpreter } from './useAuthInterpreter'

/**
 * Use the hook `useUserRoles` to get all allowed roles of the user.
 *
 * @example
 * ```tsx
 * const userRoles = useUserRoles();
 * ```
 *
 * @docs https://docs.nhost.io/reference/react/use-user-roles
 */
export const useUserRoles = (): string[] => {
  const service = useAuthInterpreter()
  return useSelector(service, (state) => {
    if (!state.matches('authentication.signedIn')) {
      return []
    }
    return state.context.user?.roles || []
  })
}
