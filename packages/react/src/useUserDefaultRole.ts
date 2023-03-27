import { useSelector } from '@xstate/react'

import { useAuthInterpreter } from './useAuthInterpreter'

/**
 * Use the hook `useUserDefaultRole` to get the default role of the user.
 *
 * @example
 * ```tsx
 * const userDefaultRole = useUserDefaultRole();
 * ```
 *
 * @docs https://docs.nhost.io/reference/react/use-user-default-role
 */
export const useUserDefaultRole = (): string | undefined => {
  const service = useAuthInterpreter()
  return useSelector(
    service,
    (state) => state.context.user?.defaultRole,
    (a, b) => a === b
  )
}
