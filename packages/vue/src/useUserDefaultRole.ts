import { useSelector } from '@xstate/vue'

import { useAuthInterpreter } from './useAuthInterpreter'

/**
 * @return `Ref` to the user's default role
 */
export const useUserDefaultRole = () => {
  const service = useAuthInterpreter()
  return useSelector(
    service.value,
    (state) => state.context.user?.defaultRole,
    (a, b) => a === b
  )
}
