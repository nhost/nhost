import { useSelector } from '@xstate/vue'

import { useAuthInterpreter } from './useAuthInterpreter'

export const useAuthenticated = () => {
  const service = useAuthInterpreter()
  return useSelector(service.value, (state) => state.matches({ authentication: 'signedIn' }))
}
