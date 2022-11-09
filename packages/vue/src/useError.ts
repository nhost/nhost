import { StateErrorTypes } from '@nhost/hasura-auth-js'
import { useSelector } from '@xstate/vue'

import { useAuthInterpreter } from './useAuthInterpreter'

/** @internal */
export const useError = (type: StateErrorTypes) => {
  const service = useAuthInterpreter()
  return useSelector(
    service.value,
    (state) => state.context.errors[type] || null,
    (a, b) => a?.error === b?.error
  )
}
