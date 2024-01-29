import { useSelector } from '@xstate/react'

import { useAuthInterpreter } from './useAuthInterpreter'

/**
 * Use the hook `useHasElevatedPermissions` to check if the user has elevated permissions.
 *
 * @example
 * ```tsx
 * const elevated = useHasElevatedPermissions();
 * ```
 *
 * @docs https://docs.nhost.io/reference/react/use-has-elevated-permissions
 */
export const useHasElevatedPermissions = (): boolean | undefined => {
  const service = useAuthInterpreter()
  return useSelector(
    service,
    (state) => state.context.elevated,
    (a, b) => a === b
  )
}
