import { unref } from 'vue'

import { createResetPasswordMachine, ResetPasswordOptions } from '@nhost/core'
import { useMachine } from '@xstate/vue'

import { RefOrValue } from './helpers'
import { useNhostClient } from './useNhostClient'

export const useResetPassword = (options?: RefOrValue<ResetPasswordOptions | undefined>) => {
  const { client } = useNhostClient()
  const { state, send } = useMachine(createResetPasswordMachine(client.auth.client))
  const isError = state.value.matches({ idle: 'error' })
  const isSent = state.value.matches({ idle: 'success' })
  const error = state.value.context.error
  const isLoading = state.value.matches('requesting')

  const resetPassword = (email: RefOrValue<string>) =>
    send({
      type: 'REQUEST',
      email: unref(email),
      options: unref(options)
    })
  return { resetPassword, isLoading, isSent, isError, error }
}
