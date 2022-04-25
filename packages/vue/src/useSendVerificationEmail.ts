import { computed, unref } from 'vue'

import { createSendVerificationEmailMachine, SendVerificationEmailOptions } from '@nhost/core'
import { useMachine } from '@xstate/vue'

import { RefOrValue } from './helpers'
import { useNhostClient } from './useNhostClient'

export const useSendVerificationEmail = (
  options?: RefOrValue<SendVerificationEmailOptions | undefined>
) => {
  const { client } = useNhostClient()
  const { state, send } = useMachine(createSendVerificationEmailMachine(client.auth.client))
  const isError = computed(() => state.value.matches({ idle: 'error' }))
  const isSent = computed(() => state.value.matches({ idle: 'success' }))
  const error = computed(() => state.value.context.error)
  const isLoading = computed(() => state.value.matches('requesting'))

  const sendEmail = (email: RefOrValue<string>) =>
    send({
      type: 'REQUEST',
      email: unref(email),
      options: unref(options)
    })
  return { sendEmail, isLoading, isSent, isError, error }
}
