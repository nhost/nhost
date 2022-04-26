import { useSelector } from '@xstate/vue'

import { useAuthInterpreter } from './useAuthInterpreter'

/**
 * Get the JWT access token
 */
export const useAccessToken = () => {
  const service = useAuthInterpreter()
  return useSelector(service.value, (state) => state.context.accessToken.value)
}
