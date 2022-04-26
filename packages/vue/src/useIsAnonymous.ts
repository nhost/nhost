import { useSelector } from '@xstate/vue'

import { useAuthInterpreter } from './useAuthInterpreter'

/**
 * Returns whether the user is anonymous ot not
 */
export const useIsAnonymous = () => {
  const service = useAuthInterpreter()
  return useSelector(
    service.value,
    (state) => state.context.user?.isAnonymous,
    (a, b) => a === b
  )
}
