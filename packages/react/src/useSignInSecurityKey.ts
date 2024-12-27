import {
  signInSecurityKeyPromise,
  SignInSecurityKeyHandlerResult,
  SignInSecurityKeyState
} from '@nhost/nhost-js'
import { useSelector } from '@xstate/react'
import { useAuthInterpreter } from './useAuthInterpreter'

interface SignInSecurityKeyHandler {
  (): Promise<SignInSecurityKeyHandlerResult>
}

export interface SignInSecurityKeyHookResult extends SignInSecurityKeyState {
  signInSecurityKey: SignInSecurityKeyHandler
}

interface SignInSecurityKeyHook {
  (): SignInSecurityKeyHookResult
}

/**
 * Use the hook `useSignInSecurityKey` to sign in a user with a security key using the WebAuthn API.
 *
 * @example
 * ```tsx
 * const { signInSecurityKey, needsEmailVerification, isLoading, isSuccess, isError, error } = useSignInSecurityKey()
 *
 * console.log({ needsEmailVerification, isLoading, isSuccess, isError, error });
 *
 * const handleFormSubmit = async (e) => {
 *   e.preventDefault();
 *
 *   await signInSecurityKey()
 * }
 * ```
 *
 * @docs https://docs.nhost.io/reference/react/use-sign-in-security-key
 */
export const useSignInSecurityKey: SignInSecurityKeyHook = () => {
  const service = useAuthInterpreter()

  const signInSecurityKey: SignInSecurityKeyHandler = () => signInSecurityKeyPromise(service)

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
    signInSecurityKey,
    user
  }
}
