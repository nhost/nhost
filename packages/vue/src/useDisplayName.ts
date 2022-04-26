import { useSelector } from '@xstate/vue'

import { useAuthInterpreter } from './useAuthInterpreter'

/**
 * @returns Ref to the user's display name
 */
export const useDisplayName = () => {
  const service = useAuthInterpreter()
  return useSelector(
    service.value,
    (state) => state.context.user?.displayName,
    (a, b) => a === b
  )
}
