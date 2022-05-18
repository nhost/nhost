import { useContext, useEffect, useState } from 'react'
import { InterpreterFrom } from 'xstate'

import { AuthMachine, signOutPromise } from '@nhost/core'
import { NhostClient } from '@nhost/nhost-js'
import { useSelector } from '@xstate/react'

import { NhostReactContext } from '../provider'

/**
 * Use the hook `useNhostClient` to get the Nhost JavaScript client (https://docs.nhost.io/reference/javascript).
 *
 * @example
 * ```tsx
 * const nhost = useNhostClient()
 * ```
 *
 * @docs https://docs.nhost.io/reference/react/use-nhost-client
 */
export const useNhostClient = (): NhostClient => {
  const nhost = useContext(NhostReactContext)
  return nhost
}

/** @internal */
export const useAuthInterpreter = (): InterpreterFrom<AuthMachine> => {
  const nhost = useContext(NhostReactContext)
  const interpreter = nhost.auth.client.interpreter
  if (!interpreter) throw Error('No interpreter')
  return interpreter
}

/**
 * Use the hook `useNhostBackendUrl` to get the Nhost backend URL.
 *
 * @example
 * ```tsx
 * const nhostBackendUrl = useNhostBackendUrl()
 * ```
 *
 * @docs https://docs.nhost.io/reference/react/use-nhost-backend-url
 */
export const useNhostBackendUrl = () => {
  const nhost = useContext(NhostReactContext)
  return nhost.auth.client.backendUrl.replace('/v1/auth', '')
}

/**
 * @deprecated
 * When using both {@link useAuthLoading} and {@link useAuthenticated} together, their initial state will change
 * three times:
 *
 * `(true, false)` -> `(false, false)` -> `(false, true)`
 *
 * Use {@link useAuthenticationStatus} instead.
 */
export const useAuthLoading = () => {
  const service = useAuthInterpreter()
  return useSelector(service, (state) => state.hasTag('loading'))
}

/**
 * Use `useAuthenticationStatus` to get the authentication status for the user.
 *
 * @example
 * ```tsx
 * const { isAuthenticated, isLoading } = useAuthenticationStatus();
 * ```
 */
export const useAuthenticationStatus = () => {
  const service = useAuthInterpreter()
  return useSelector(
    service,
    (state) => ({
      isAuthenticated: state.matches({ authentication: 'signedIn' }),
      isLoading: state.hasTag('loading'),
      error: state.context.errors.authentication || null,
      isError: state.matches({ authentication: { signedOut: 'failed' } })
    }),
    (a, b) => a.isAuthenticated === b.isAuthenticated && a.isLoading === b.isLoading
  )
}

/**
 * Use `useAuthenticated` to get the authentication status of the user.
 *
 * @example
 * ```ts
 * const isAuthenticated = useAuthenticated();
 * ```
 *
 * @docs https://docs.nhost.io/reference/react/use-access-token
 */
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

/**
 * Use `useAccessToken` to get the access token of the user.
 *
 * @example
 * ```ts
 * const accessToken = useAccessToken();
 * ```
 *
 * @docs https://docs.nhost.io/reference/react/use-access-token
 */
export const useAccessToken = () => {
  const service = useAuthInterpreter()
  return useSelector(service, (state) => state.context.accessToken.value)
}

/**
 * Use the hook `useSignOut` to sign out the user.
 *
 * @example
 * ```tsx
 * import { useSignOut, useAuthenticated } from '@nhost/react'
 *
 * const Component = () => {
 *   const { signOut } = useSignOut()
 *   const isAuthenticated = useAuthenticated()
 *
 *   if (isAuthenticated) {
 *     return (
 *       <button onClick={() => signOut()}>Sign Out</button>
 *     )
 *   }
 *
 *   return <div>Not authenticated</div>
 * }
 * ```
 *
 * @docs https://docs.nhost.io/reference/react/use-sign-out
 */
export const useSignOut = (stateAll: boolean = false) => {
  const service = useAuthInterpreter()
  const signOut = (valueAll?: boolean | unknown) =>
    signOutPromise(service, typeof valueAll === 'boolean' ? valueAll : stateAll)

  const isSuccess = useSelector(
    service,
    (state) => state.matches({ authentication: { signedOut: 'success' } }),
    (a, b) => a === b
  )

  const error = useSelector(
    service,
    (state) => state.context.errors.signOut || null,
    (a, b) => a?.error === b?.error
  )

  return { signOut, isSuccess, error }
}
