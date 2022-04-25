import { useSelector } from '@xstate/vue'

import { useAuthInterpreter } from './useAuthInterpreter'

export const useUserRoles = () => {
  const service = useAuthInterpreter()
  return useSelector(
    service.value,
    (state) => state.context.user?.roles || [],
    (a, b) => a.every((i) => b.includes(i) && b.every((i) => a.includes(i)))
  )
}
