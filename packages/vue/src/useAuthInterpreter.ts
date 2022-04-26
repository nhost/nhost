import { computed, Ref } from 'vue'
import { InterpreterFrom } from 'xstate'

import { AuthMachine } from '@nhost/core'

import { useNhostClient } from './useNhostClient'

/** @internal */
export const useAuthInterpreter = (): Ref<InterpreterFrom<AuthMachine>> => {
  const { client } = useNhostClient()

  return computed(() => {
    const interpreter = client.auth.client.interpreter
    if (!interpreter) throw Error('No interpreter')
    return interpreter
  })
}
