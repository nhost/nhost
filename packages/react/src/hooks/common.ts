import { useContext, useEffect, useState } from 'react'
import { InterpreterFrom } from 'xstate'

import { AuthMachine, ErrorPayload } from '@nhost/core'
import { NhostClient } from '@nhost/nhost-js'
import { useSelector } from '@xstate/react'

import { NhostReactContext } from '../provider'

export interface ActionHookErrorState {
  /** @return `true` if an error occurred */
  isError: boolean
  /** Provides details about the error */
  error: ErrorPayload | null
}

export interface ActionHookLoadingState {
  /**
   * @return `true` when the action is executing, `false` when it finished its execution.
   */
  isLoading: boolean
}
export interface CommonActionHookState extends ActionHookErrorState, ActionHookLoadingState {}

export interface ActionHookSuccessState {
  /** Returns `true` if the action is successful. */
  isSuccess: boolean
}

export interface DefaultActionHookState extends CommonActionHookState, ActionHookSuccessState {}

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
  return useSelector(service, (state) => !state.hasTag('ready'))
}

/**
 * The Nhost client may need some initial steps to determine the authentication status during startup, like fetching a new JWT from an existing refresh token.
 * @return `isLoading` will return `true` until the authentication status is known.
 * 
 * `        isAuthenticated` returns `true` if the user is authenticated, `false` if not or if the client is still determining the status.
 * @example
```jsx
import { useAuthenticationStatus } from '@nhost/react';

const Component = () => {
  const { isLoading, isAuthenticated } = useAuthenticationStatus();
  if (isLoading) {
    return <div>Loading Nhost authentication status...</div>;
  }

  if (isAuthenticated) {
    return <div>User is authenticated</div>;
  }

  return <div>Public section</div>;
};
```
*/
export const useAuthenticationStatus = () => {
  const service = useAuthInterpreter()
  return useSelector(
    service,
    (state) => ({
      isAuthenticated: state.matches({ authentication: 'signedIn' }),
      isLoading: !state.hasTag('ready'),
      error: state.context.errors.authentication || null,
      isError: state.matches({ authentication: { signedOut: 'failed' } })
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

/**
 * Get the JWT access token
 */
export const useAccessToken = () => {
  const service = useAuthInterpreter()
  return useSelector(service, (state) => state.context.accessToken.value)
}

/**
 * Sign out
 * The `useSignOut` hook accepts an `all` argument that will be used when the `signOut` method will be called. This value can be overriden in calling `signOut(allValue)`.
 * 
 * @example
```js
const { signOut, isSuccess } = useSignOut();
```
 * @example
```jsx
import { useState } from 'react';
import { useSignOut, useAuthenticated } from '@nhost/react';

const Component = () => {
  const { signOut, isSuccess } = useSignOut();
  const authenticated = useAuthenticated();

  if (authenticated) {
    return (
      <div>
        <button onClick={signUp}>Sign Out</button>
        {isSuccess && <div>You have successfully signed out!</div>}
      </div>
    );
  }

  return <div>Not authenticated</div>;
};
```
*/
export const useSignOut = (stateAll: boolean = false) => {
  const service = useAuthInterpreter()
  const signOut = (valueAll?: boolean | unknown) =>
    new Promise<{ isSuccess: boolean }>((resolve) => {
      service.send('SIGNOUT', { all: typeof valueAll === 'boolean' ? valueAll : stateAll })
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
