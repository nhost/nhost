import { useSelector } from '@xstate/vue'

import { useAuthInterpreter } from './useAuthInterpreter'

/**
 * Use the composable `useUserLocale` to get the locale of the current user.
 *
 * @example
 * ```tsx
 * const userLocale = useUserLocale();
 * ```
 *
 * @docs https://docs.nhost.io/reference/vue/use-user-locale
 */
export const useUserLocale = () => {
  const service = useAuthInterpreter()
  return useSelector(
    service.value,
    (state) => state.context.user?.locale,
    (a, b) => a === b
  )
}
