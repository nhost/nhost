import { useSelector } from '@xstate/react'

import { useAuthInterpreter } from './useAuthInterpreter'

/**
 * Use `useAccessToken` to get the access token of the user.
 *
 * @example
 * ```ts
 * const accessToken = useAccessToken();
 * ```
 *
 * @docs https://docs.nhost.io/reference/react/use-access-token
 */
export const useAccessToken = (): string | null => {
  const service = useAuthInterpreter()
  return useSelector(service, (state) => state.context.accessToken.value)
}
