import { AuthErrorPayload, StateErrorTypes } from '@nhost/nhost-js'
import { useSelector } from '@xstate/vue'
import { Ref } from 'vue'
import { useAuthInterpreter } from './useAuthInterpreter'

/** @internal */
export const useError = (type: StateErrorTypes): Ref<AuthErrorPayload | null> => {
  const service = useAuthInterpreter()
  return useSelector(
    service.value,
    (state) => state.context.errors[type] || null,
    (a, b) => a?.error === b?.error
  )
}
