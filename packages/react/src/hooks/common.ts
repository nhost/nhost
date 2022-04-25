import { useContext, useEffect, useState } from 'react'
import { InterpreterFrom } from 'xstate'

import { AuthMachine, ErrorPayload } from '@nhost/core'
import { NhostClient } from '@nhost/nhost-js'
import { useSelector } from '@xstate/react'

import { NhostReactContext } from '../provider'

export type ActionHookState<T extends string = 'isSuccess'> = {
  isLoading: boolean

  isError: boolean
  error: ErrorPayload | null
} & Record<T, boolean>

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

/**
 * @deprecated
 * When using both `useAuthLoading` and `useAuthenticated` together, their initial state will change
 * three times:
 *
 * `(true, false)` -> `(false, false)` -> `(false, true)`
 *
 * Use `useAuthenticationStatus` instead.
 */
export const useAuthLoading = () => {
  const service = useAuthInterpreter()
  return useSelector(service, (state) => !state.hasTag('ready'))
}

export const useAuthenticationStatus = () => {
  const service = useAuthInterpreter()
  return useSelector(
    service,
    (state) => ({
      isAuthenticated: state.matches({ authentication: 'signedIn' }),
      isLoading: !state.hasTag('ready')
    }),
    (a, b) => a.isAuthenticated === b.isAuthenticated && a.isLoading === b.isLoading
  )
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
    new Promise<{ isSuccess: boolean }>((resolve) => {
      service.send({ type: 'SIGNOUT', all: typeof valueAll === 'boolean' ? valueAll : stateAll })
      service.onTransition((state) => {
        if (state.matches({ authentication: { signedOut: 'success' } })) {
          resolve({ isSuccess: true })
        } else if (state.matches({ authentication: { signedOut: { failed: 'server' } } }))
          resolve({ isSuccess: false })
      })
    })

  const isSuccess = useSelector(
    service,
    (state) => state.matches({ authentication: { signedOut: 'success' } }),
    (a, b) => a === b
  )

  return { signOut, isSuccess }
}
