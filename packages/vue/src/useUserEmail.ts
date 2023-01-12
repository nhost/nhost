import { useSelector } from '@xstate/vue'
import { Ref } from 'vue'

import { useAuthInterpreter } from './useAuthInterpreter'

/**
 * Use the composbale `useUserEmail` to get the email of the user.
 *
 * @example
 * ```tsx
 * const userEmail = useUserEmail();
 * ```
 *
 * @docs https://docs.nhost.io/reference/vue/use-user-email
 */
export const useUserEmail = (): Ref<string | undefined> => {
  const service = useAuthInterpreter()
  return useSelector(
    service.value,
    (state) => state.context.user?.email,
    (a, b) => a === b
  )
}
