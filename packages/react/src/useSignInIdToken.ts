import {
  SignInIdTokenHandlerResult,
  SignInIdTokenState,
  signInIdTokenPromise,
  Provider
} from '@nhost/nhost-js'
import { useSelector } from '@xstate/react'
import { useAuthInterpreter } from './useAuthInterpreter'

interface SignInIdTokenHandler {
  (provider: Provider, idToken: string, nonce?: string): Promise<SignInIdTokenHandlerResult>
}

export interface SignInIdTokenHookResult extends SignInIdTokenState {
  signInIdToken: SignInIdTokenHandler
}

interface SignInIdTokenHook {
  (): SignInIdTokenHookResult
}

/**
 * Use the hook `useSignInIdToken` to sign in a user using an `idToken`.
 *
 * @example
 * ```tsx
 * const { signInIdToken, isLoading, isSuccess, isError, error } = useSignInIdToken()
 *
 * console.log({ isLoading, isSuccess, isError, error });
 *
 * const handleFormSubmit = async (e) => {
 *   e.preventDefault();
 *
 *   await signInIdToken({ provider: 'google', idToken: '...' })
 * }
 * ```
 *
 * @docs https://docs.nhost.io/reference/react/use-sign-in-idtoken
 */
export const useSignInIdToken: SignInIdTokenHook = () => {
  const service = useAuthInterpreter()
  const signInIdToken: SignInIdTokenHandler = (
    provider: Provider,
    idToken: string,
    nonce?: string
  ) =>
    signInIdTokenPromise(service, {
      provider,
      idToken,
      nonce
    })

  const user = useSelector(
    service,
    (state) => state.context.user,
    (a, b) => a?.id === b?.id
  )

  const accessToken = useSelector(service, (state) => state.context.accessToken.value)

  const refreshToken = useSelector(service, (state) => state.context.refreshToken.value)

  const error = useSelector(
    service,
    (state) => state.context.errors.authentication || null,
    (a, b) => a?.error === b?.error
  )

  const isSuccess = useSelector(service, (state) => state.matches({ authentication: 'signedIn' }))

  const isLoading = useSelector(
    service,
    (state) => state.matches({ authentication: { authenticating: 'idToken' } }),
    (a, b) => a === b
  )

  const isError = useSelector(
    service,
    (state) => state.matches({ authentication: { signedOut: 'failed' } }),
    (a, b) => a === b
  )

  return {
    accessToken,
    refreshToken,
    error,
    isError,
    isLoading,
    isSuccess,
    signInIdToken,
    user
  }
}
