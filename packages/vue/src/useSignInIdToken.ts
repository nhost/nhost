import {
  SignInIdTokenHandlerResult,
  SignInIdTokenState,
  signInIdTokenPromise,
  Provider
} from '@nhost/nhost-js'
import { useSelector } from '@xstate/vue'
import { RefOrValue } from './helpers'
import { ToRefs, unref } from 'vue'
import { useAuthInterpreter } from './useAuthInterpreter'

interface SignInIdTokenResult extends ToRefs<SignInIdTokenState> {
  signInIdToken(
    provider: RefOrValue<Provider>,
    idToken: RefOrValue<string>,
    nonce?: RefOrValue<string>
  ): Promise<SignInIdTokenHandlerResult>
}

/**
 * Use the composable `useSignInIdToken` to sign in a user using an `idToken`.
 *
 * @example
 * ```ts
 * const { signInIdToken, isLoading, isSuccess, isError, error } = useSignInIdToken()
 *
 * console.log({ isLoading, isSuccess, isError, error });
 *
 * const handleSignInIdToken = async () => {
 *   await signInIdToken({ provider: 'google', idToken: '...' })
 * }
 * ```
 *
 * @docs https://docs.nhost.io/reference/vue/use-sign-in-idtoken
 */
export const useSignInIdToken = (): SignInIdTokenResult => {
  const service = useAuthInterpreter()

  const signInIdToken = (
    provider: RefOrValue<Provider>,
    idToken: RefOrValue<string>,
    nonce?: RefOrValue<string>
  ) =>
    signInIdTokenPromise(service.value, {
      provider: unref(provider),
      idToken: unref(idToken),
      nonce: unref(nonce)
    })

  const user = useSelector(
    service.value,
    (state) => state.context.user,
    (a, b) => a?.id === b?.id
  )

  const accessToken = useSelector(service.value, (state) => state.context.accessToken.value)

  const refreshToken = useSelector(service.value, (state) => state.context.refreshToken.value)

  const error = useSelector(
    service.value,
    (state) => state.context.errors.authentication || null,
    (a, b) => a?.error === b?.error
  )

  const isSuccess = useSelector(service.value, (state) =>
    state.matches({ authentication: 'signedIn' })
  )

  const isLoading = useSelector(
    service.value,
    (state) => state.matches({ authentication: { authenticating: 'idToken' } }),
    (a, b) => a === b
  )

  const isError = useSelector(
    service.value,
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
