import {
  signInEmailSecurityKeyPromise,
  SignInSecurityKeyPasswordlessHandlerResult,
  SignInSecurityKeyPasswordlessState
} from '@nhost/nhost-js'
import { useSelector } from '@xstate/react'
import { useAuthInterpreter } from './useAuthInterpreter'

interface SignInSecurityKeyPasswordlessHandler {
  (email: string): Promise<SignInSecurityKeyPasswordlessHandlerResult>
}

export interface SignInSecurityKeyPasswordlessHookResult
  extends SignInSecurityKeyPasswordlessState {
  signInEmailSecurityKey: SignInSecurityKeyPasswordlessHandler
}

interface SignInSecurityKeyPasswordlessHook {
  (): SignInSecurityKeyPasswordlessHookResult
}

/**
 * Use the hook `useSignInEmailSecurityKey` to sign in a user using their email and a security key using the WebAuthn API.
 *
 * @example
 * ```tsx
 * const { signInEmailSecurityKey, needsEmailVerification, isLoading, isSuccess, isError, error } = useSignInEmailSecurityKey()
 *
 * console.log({ needsEmailVerification, isLoading, isSuccess, isError, error });
 *
 * const handleFormSubmit = async (e) => {
 *   e.preventDefault();
 *
 *   await signInEmailSecurityKey('joe@example.com')
 * }
 * ```
 *
 * @docs https://docs.nhost.io/reference/react/use-sign-in-web-authn
 */
export const useSignInEmailSecurityKey: SignInSecurityKeyPasswordlessHook = () => {
  const service = useAuthInterpreter()
  const signInEmailSecurityKey: SignInSecurityKeyPasswordlessHandler = (email: string) =>
    signInEmailSecurityKeyPromise(service, email)

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
  const isSuccess = useSelector(service, (state) =>
    state.matches({
      authentication: 'signedIn'
    })
  )
  const isLoading = useSelector(
    service,
    (state) => state.matches({ authentication: { authenticating: 'securityKeyEmail' } }),
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
    refreshToken,
    error,
    isError,
    isLoading,
    isSuccess,
    needsEmailVerification,
    signInEmailSecurityKey,
    user
  }
}
