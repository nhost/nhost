import { useSelector } from '@xstate/vue'
import { Ref } from 'vue'

import { useAuthInterpreter } from './useAuthInterpreter'

/**
 * Use the composable `useUserLocale` to get the locale of the user.
 *
 * @example
 * ```tsx
 * const userLocale = useUserLocale();
 * ```
 *
 * @docs https://docs.nhost.io/reference/vue/use-user-locale
 */
export const useUserLocale = (): Ref<string | undefined> => {
  const service = useAuthInterpreter()
  return useSelector(
    service.value,
    (state) => state.context.user?.locale,
    (a, b) => a === b
  )
}
