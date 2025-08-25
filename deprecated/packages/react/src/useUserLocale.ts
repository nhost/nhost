import { useSelector } from '@xstate/react'

import { useAuthInterpreter } from './useAuthInterpreter'

/**
 * Use the hook `useUserLocale` to get the locale of the user.
 *
 * @example
 * ```tsx
 * const userLocale = useUserLocale();
 * ```
 *
 * @docs https://docs.nhost.io/reference/react/use-user-locale
 */
export const useUserLocale = (): string | undefined => {
  const service = useAuthInterpreter()
  return useSelector(
    service,
    (state) => state.context.user?.locale,
    (a, b) => a === b
  )
}
