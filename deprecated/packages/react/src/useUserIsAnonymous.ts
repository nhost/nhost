import { useSelector } from '@xstate/react'

import { useAuthInterpreter } from './useAuthInterpreter'

/**
 * Use the hook `useUserIsAnonymous` to see if the user is anonymous or not.
 *
 * @example
 * ```tsx
 * const userIsAnonymous = useUserIsAnonymous();
 * ```
 *
 * @docs https://docs.nhost.io/reference/react/use-user-is-anonymous
 */
export const useUserIsAnonymous = (): boolean | undefined => {
  const service = useAuthInterpreter()
  return useSelector(
    service,
    (state) => state.context.user?.isAnonymous,
    (a, b) => a === b
  )
}
