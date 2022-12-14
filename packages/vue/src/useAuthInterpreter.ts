import { AuthMachine } from '@nhost/nhost-js'
import { computed, Ref } from 'vue'
import { InterpreterFrom } from 'xstate'
import { useNhostClient } from './useNhostClient'

/** @internal */
export const useAuthInterpreter = (): Ref<InterpreterFrom<AuthMachine>> => {
  const { nhost } = useNhostClient()

  return computed(() => {
    const interpreter = nhost.auth.client.interpreter
    if (!interpreter) throw Error('No interpreter')
    return interpreter
  })
}
