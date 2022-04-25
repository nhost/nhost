import { computed, unref } from 'vue'

import { ChangeEmailOptions, createChangeEmailMachine } from '@nhost/core'
import { useMachine } from '@xstate/vue'

import { RefOrValue } from './helpers'
import { useNhostClient } from './useNhostClient'

export const useChangeEmail = (options?: RefOrValue<ChangeEmailOptions | undefined>) => {
  const { client } = useNhostClient()
  const { state, send } = useMachine(createChangeEmailMachine(client.auth.client))

  const isError = computed(() => state.value.matches({ idle: 'error' }))
  const needsEmailVerification = computed(() => state.value.matches({ idle: 'success' }))
  const error = computed(() => state.value.context.error)
  const isLoading = computed(() => state.value.matches('requesting'))

  const changeEmail = (email: RefOrValue<string>) => {
    send({
      type: 'REQUEST',
      email: unref(email),
      options: unref(options)
    })
  }

  return { changeEmail, isLoading, needsEmailVerification, isError, error }
}
