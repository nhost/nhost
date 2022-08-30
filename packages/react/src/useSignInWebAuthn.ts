import {
  SignInWebAuthnHandlerResult,
  signInWebAuthnPromise,
  SignInWebAuthnState
} from '@nhost/core'
import { useSelector } from '@xstate/react'

import { useAuthInterpreter } from './useAuthInterpreter'

interface SignInWebAuthnHandler {
  (email: string): Promise<SignInWebAuthnHandlerResult>
}

export interface SignInWebAuthnHookResult extends SignInWebAuthnState {
  signInWebAuthn: SignInWebAuthnHandler
}

interface SignInWebAuthnHook {
  (): SignInWebAuthnHookResult
}

/**
 * Use the hook `useSignInWebAuthn` to sign in a user using WebAuthn.
 *
 * @example
 * ```tsx
 * const { signInWebAuthn, needsEmailVerification, isLoading, isSuccess, isError, error } = useSignInWebAuthn()
 *
 * console.log({ needsEmailVerification, isLoading, isSuccess, isError, error });
 *
 * const handleFormSubmit = async (e) => {
 *   e.preventDefault();
 *
 *   await signInWebAuthn('joe@example.com')
 * }
 * ```
 *
 * @docs https://docs.nhost.io/reference/react/use-sign-in-web-authn
 */
export const useSignInWebAuthn: SignInWebAuthnHook = () => {
  const service = useAuthInterpreter()
  const signInWebAuthn: SignInWebAuthnHandler = (email: string) =>
    signInWebAuthnPromise(service, email)

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
    (state) => state.matches({ authentication: { authenticating: 'webauthn' } }),
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
    signInWebAuthn,
    user
  }
}
