import { useSelector } from '@xstate/vue'

import { useAuthInterpreter } from './useAuthInterpreter'

export const useDisplayName = () => {
  const service = useAuthInterpreter()
  return useSelector(
    service.value,
    (state) => state.context.user?.displayName,
    (a, b) => a === b
  )
}
