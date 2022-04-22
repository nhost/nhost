import { computed, Ref } from 'vue'
import { InterpreterFrom } from 'xstate'

import { AuthMachine } from '@nhost/core'
import { NhostClient } from '@nhost/nhost-js'
import { useSelector } from '@xstate/vue'

import { nhostClient } from '../client'

export const useNhostClient = (): Ref<NhostClient> =>
  computed(() => {
    if (!nhostClient.value) throw Error('No Nhost client')
    return nhostClient.value
  })

export const useAuthInterpreter = (): Ref<InterpreterFrom<AuthMachine>> =>
  computed(() => {
    const interpreter = nhostClient.value?.auth.client.interpreter
    if (!interpreter) throw Error('No interpreter')
    return interpreter
  })

export const useNhostBackendUrl = () => {
  const nhost = useNhostClient()
  return computed(() => nhost.value.auth.client.backendUrl.replace('/v1/auth', ''))
}

export const useAuthenticationStatus = () => {
  const service = useAuthInterpreter()
  // TODO review this
  const status = useSelector(
    service.value,
    (state) => ({
      isAuthenticated: state.matches({ authentication: 'signedIn' }),
      isLoading: !state.hasTag('ready')
    }),
    (a, b) => a.isAuthenticated === b.isAuthenticated && a.isLoading === b.isLoading
  )
  return {
    isAuthenticated: computed(() => status.value.isAuthenticated),
    isLoading: computed(() => status.value.isLoading)
  }
}

export const useAuthenticated = () => {
  const service = useAuthInterpreter()
  return useSelector(service.value, (state) =>
    service.value.state.matches({ authentication: 'signedIn' })
  )
}

export const useAccessToken = () => {
  const service = useAuthInterpreter()
  return useSelector(service.value, (state) => state.context.accessToken.value)
}

export const useSignOut = (stateAll: boolean = false) => {
  const service = useAuthInterpreter()
  const signOut = (valueAll?: boolean | unknown) =>
    service.value.send({
      type: 'SIGNOUT',
      all: typeof valueAll === 'boolean' ? valueAll : stateAll
    })
  const isSuccess = useSelector(service.value, (state) =>
    state.matches({ authentication: { signedOut: 'success' } })
  )
  // ? In React:
  //  const isSuccess = !!service.value.status && service.state.matches({ authentication: { signedOut: 'success' } })
  return { signOut, isSuccess }
}
