import { useSelector } from '@xstate/react'

import { useAuthInterpreter } from './useAuthInterpreter'

/**
 * Use the hook `useUserEmail` to get the email of the user.
 *
 * @example
 * ```tsx
 * const userEmail = useUserEmail();
 * ```
 *
 * @docs https://docs.nhost.io/reference/react/use-user-email
 */
export const useUserEmail = (): string | undefined => {
  const service = useAuthInterpreter()
  return useSelector(
    service,
    (state) => state.context.user?.email,
    (a, b) => a === b
  )
}
