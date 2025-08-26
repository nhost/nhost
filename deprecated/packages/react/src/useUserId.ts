import { useSelector } from '@xstate/react'

import { useAuthInterpreter } from './useAuthInterpreter'

/**
 * Use the hook `useUserId` to get the id of the user.
 *
 * @example
 * ```tsx
 * const userId = useUserId();
 * ```
 *
 * @docs https://docs.nhost.io/reference/react/use-user-id
 */
export const useUserId = (): string | undefined => {
  const service = useAuthInterpreter()
  return useSelector(
    service,
    (state) => state.context.user?.id,
    (a, b) => a === b
  )
}
