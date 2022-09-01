import {
  SignInWebAuthnPasswordlessHandlerResult,
  signInWebAuthnPasswordlessPromise,
  SignInWebAuthnPasswordlessState
} from '@nhost/core'
import { useSelector } from '@xstate/react'

import { useAuthInterpreter } from './useAuthInterpreter'

interface SignInWebAuthnPasswordlessHandler {
  (email: string): Promise<SignInWebAuthnPasswordlessHandlerResult>
}

export interface SignInWebAuthnPasswordlessHookResult extends SignInWebAuthnPasswordlessState {
  signInWebAuthnPasswordless: SignInWebAuthnPasswordlessHandler
}

interface SignInWebAuthnPasswordlessHook {
  (): SignInWebAuthnPasswordlessHookResult
}

/**
 * Use the hook `useSignInWebAuthnPasswordless` to sign in a user using WebAuthn.
 *
 * @example
 * ```tsx
 * const { signInWebAuthnPasswordless, needsEmailVerification, isLoading, isSuccess, isError, error } = useSignInWebAuthnPasswordless()
 *
 * console.log({ needsEmailVerification, isLoading, isSuccess, isError, error });
 *
 * const handleFormSubmit = async (e) => {
 *   e.preventDefault();
 *
 *   await signInWebAuthnPasswordless('joe@example.com')
 * }
 * ```
 *
 * @docs https://docs.nhost.io/reference/react/use-sign-in-web-authn
 */
export const useSignInWebAuthnPasswordless: SignInWebAuthnPasswordlessHook = () => {
  const service = useAuthInterpreter()
  const signInWebAuthnPasswordless: SignInWebAuthnPasswordlessHandler = (email: string) =>
    signInWebAuthnPasswordlessPromise(service, email)

  const user = useSelector(
    service,
    (state) => state.context.user,
    (a, b) => a?.id === b?.id
  )
  const accessToken = useSelector(service, (state) => state.context.accessToken.value)
  const error = useSelector(
    service,
    (state) => state.context.errors.authentication || null,
    (a, b) => a?.error === b?.error
  )
  const isSuccess = useSelector(service, (state) =>
    state.matches({
      authentication: 'signedIn'
    })
  )
  const isLoading = useSelector(
    service,
    (state) => state.matches({ authentication: { authenticating: 'webauthnPasswordless' } }),
    (a, b) => a === b
  )
  const needsEmailVerification = useSelector(
    service,
    (state) =>
      state.matches({
        authentication: { signedOut: 'noErrors' },
        registration: { incomplete: 'needsEmailVerification' }
      }),
    (a, b) => a === b
  )
  const isError = useSelector(
    service,
    (state) => state.matches({ authentication: { signedOut: 'failed' } }),
    (a, b) => a === b
  )

  return {
    accessToken,
    error,
    isError,
    isLoading,
    isSuccess,
    needsEmailVerification,
    signInWebAuthnPasswordless,
    user
  }
}
