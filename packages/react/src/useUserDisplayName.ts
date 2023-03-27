import { useSelector } from '@xstate/react'

import { useAuthInterpreter } from './useAuthInterpreter'

/**
 * Use the hook `useUserDisplayName` to get the display name of the user.
 *
 * @example
 * ```tsx
 * const userDisplayName = useUserDisplayName();
 * ```
 *
 * @docs https://docs.nhost.io/reference/react/use-user-display-name
 */
export const useUserDisplayName = (): string | undefined => {
  const service = useAuthInterpreter()
  return useSelector(
    service,
    (state) => state.context.user?.displayName,
    (a, b) => a === b
  )
}
