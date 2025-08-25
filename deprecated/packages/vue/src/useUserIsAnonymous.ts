import { useSelector } from '@xstate/vue'
import { Ref } from 'vue'

import { useAuthInterpreter } from './useAuthInterpreter'

/**
 * Use the composable `useUserIsAnonymous` to see if the user is anonymous or not.
 *
 * @example
 * ```tsx
 * const userIsAnonymous = useUserIsAnonymous();
 * ```
 *
 * @docs https://docs.nhost.io/reference/vue/use-user-is-anonymous
 */
export const useUserIsAnonymous = (): Ref<boolean | undefined> => {
  const service = useAuthInterpreter()
  return useSelector(
    service.value,
    (state) => state.context.user?.isAnonymous,
    (a, b) => a === b
  )
}
