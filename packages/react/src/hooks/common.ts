import { useContext, useEffect, useState } from 'react'
import { InterpreterFrom } from 'xstate'

import { AuthMachine } from '@nhost/core'
import { NhostClient } from '@nhost/nhost-js'
import { useSelector } from '@xstate/react'

import { NhostReactContext } from '../provider'

export const useNhostClient = (): NhostClient => {
  const nhost = useContext(NhostReactContext)
  return nhost
}

export const useAuthInterpreter = (): InterpreterFrom<AuthMachine> => {
  const nhost = useContext(NhostReactContext)
  const interpreter = nhost.auth.client.interpreter
  if (!interpreter) throw Error('No interpreter')
  return interpreter
}

export const useNhostBackendUrl = () => {
  const nhost = useContext(NhostReactContext)
  return nhost.auth.client.backendUrl.replace('/v1/auth', '')
}

export const useAuthLoading = () => {
  const service = useAuthInterpreter()
  const [isLoading, setIsLoading] = useState(
    !service.status || !service?.state?.hasTag('ready')
  )
  useEffect(() => {
    const subscription = service.subscribe((state) => {
      const newValue = !state.hasTag('ready')
      setIsLoading(newValue)
    })
    return subscription.unsubscribe
  }, [service])

  return isLoading
}

export const useAuthenticated = () => {
  const service = useAuthInterpreter()
  const [isAuthenticated, setIsAuthenticated] = useState(
    !!service.status && service.state.matches({ authentication: 'signedIn' })
  )
  useEffect(() => {
    const subscription = service.subscribe((state) => {
      const newValue = state.matches({ authentication: 'signedIn' })
      setIsAuthenticated(newValue)
    })
    return subscription.unsubscribe
  }, [service])
  return isAuthenticated

}


export const useAccessToken = () => {
  const service = useAuthInterpreter()
  return useSelector(service, (state) => state.context.accessToken.value)
}

export const useSignOut = (stateAll: boolean = false) => {
  const service = useAuthInterpreter()
  const signOut = (valueAll?: boolean | unknown) =>
    service.send({ type: 'SIGNOUT', all: typeof valueAll === 'boolean' ? valueAll : stateAll })
  const isSuccess =
    !!service.status && service.state.matches({ authentication: { signedOut: 'success' } })
  return { signOut, isSuccess }
}
