import { useSelector } from '@xstate/vue'

import { useAuthInterpreter } from './useAuthInterpreter'

/**
 * @returns `Ref` to the user's email
 */
export const useEmail = () => {
  const service = useAuthInterpreter()
  return useSelector(
    service.value,
    (state) => state.context.user?.email,
    (a, b) => a === b
  )
}
