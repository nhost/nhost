import { useSelector } from '@xstate/vue'
import { Ref } from 'vue'

import { useAuthInterpreter } from './useAuthInterpreter'

/**
 * Use `useAccessToken` to get the access token of the user.
 *
 * @example
 * ```ts
 * const accessToken = useAccessToken();
 * ```
 *
 * @docs https://docs.nhost.io/reference/vue/use-access-token
 */
export const useAccessToken = (): Ref<string | null> => {
  const service = useAuthInterpreter()
  return useSelector(service.value, (state) => state.context.accessToken.value)
}
