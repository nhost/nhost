import { useSelector } from '@xstate/vue'

import { useAuthInterpreter } from './useAuthInterpreter'

export const useUserData = () => {
  const service = useAuthInterpreter()
  return useSelector(
    service.value,
    (state) => state.context.user,
    (a, b) => JSON.stringify(a) === JSON.stringify(b)
  )
}
