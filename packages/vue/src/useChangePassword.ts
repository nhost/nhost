import { computed, unref } from 'vue'

import { createChangePasswordMachine } from '@nhost/core'
import { useMachine } from '@xstate/vue'

import { RefOrValue } from './helpers'
import { useNhostClient } from './useNhostClient'

export const useChangePassword = () => {
  const { client } = useNhostClient()

  const { state, send } = useMachine(createChangePasswordMachine(client.auth.client))
  const isError = computed(() => state.value.matches({ idle: 'error' }))
  const isSuccess = computed(() => state.value.matches({ idle: 'success' }))
  const error = computed(() => state.value.context.error)
  const isLoading = computed(() => state.value.matches('requesting'))

  const changePassword = (password: RefOrValue<string>) =>
    send({
      type: 'REQUEST',
      password: unref(password)
    })

  return { changePassword, isLoading, isSuccess, isError, error }
}
