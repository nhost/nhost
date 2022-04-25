import { useSelector } from '@xstate/vue'

import { useAuthInterpreter } from './useAuthInterpreter'

export const useAccessToken = () => {
  const service = useAuthInterpreter()
  return useSelector(service.value, (state) => state.context.accessToken.value)
}
