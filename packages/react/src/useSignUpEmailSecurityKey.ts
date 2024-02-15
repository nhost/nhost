import {
  signUpEmailSecurityKeyPromise,
  SignUpSecurityKeyOptions,
  SignUpSecurityKeyState
} from '@nhost/nhost-js'
import { useSelector } from '@xstate/react'
import { useAuthInterpreter } from './useAuthInterpreter'

type SignUpSecurityKeyHandlerResult = Omit<SignUpSecurityKeyState, 'isLoading'>

interface SignUpSecurityKeyHandler {
  (email: string, options?: SignUpSecurityKeyOptions): Promise<SignUpSecurityKeyHandlerResult>
}

export interface SignUpSecurityKeyHookResult extends SignUpSecurityKeyState {
  /** Used for a new user to sign up with a security key. Returns a promise with the current context */
  signUpEmailSecurityKey: SignUpSecurityKeyHandler
}

interface SignUpSecurityKeyHook {
  (options?: SignUpSecurityKeyOptions): SignUpSecurityKeyHookResult
}

/**
 * Use the hook `useSignUpEmailSecurityKeyEmail` to sign up a user with security key and an email using the WebAuthn API.
 *
 * @example
 * ```tsx
 * const { signUpEmailSecurityKey, needsEmailVerification, isLoading, isSuccess, isError, error } = useSignUpEmailSecurityKeyEmail()
 *
 * console.log({ needsEmailVerification, isLoading, isSuccess, isError, error });
 *
 * const handleFormSubmit = async (e) => {
 *   e.preventDefault();
 *
 *   await signUpEmailSecurityKey('joe@example.com')
 * }
 * ```
 *
 * @docs https://docs.nhost.io/reference/react/use-sign-up-security-key
 */
export const useSignUpEmailSecurityKeyEmail: SignUpSecurityKeyHook = (
  hookOptions?: SignUpSecurityKeyOptions
) => {
  const service = useAuthInterpreter()
  const isError = useSelector(service, (state) => !!state.context.errors.registration)

  const error = useSelector(
    service,
    (state) => state.context.errors.registration || null,
    (a, b) => a?.error === b?.error
  )

  const isLoading = useSelector(service, (state) => state.matches('registration.securityKey'))

  const needsEmailVerification = useSelector(service, (state) =>
    state.matches('registration.incomplete.needsEmailVerification')
  )

  const isSuccess = useSelector(service, (state) =>
    state.matches({
      authentication: 'signedIn',
      registration: 'complete'
    })
  )

  const signUpEmailSecurityKey: SignUpSecurityKeyHandler = (email, options = hookOptions) =>
    signUpEmailSecurityKeyPromise(service, email, options)

  const user = useSelector(
    service,
    (state) => state.context.user,
    (a, b) => a?.id === b?.id
  )
  const accessToken = useSelector(service, (state) => state.context.accessToken.value)

  const refreshToken = useSelector(service, (state) => state.context.refreshToken.value)

  return {
    accessToken,
    refreshToken,
    error,
    isError,
    isLoading,
    isSuccess,
    needsEmailVerification,
    signUpEmailSecurityKey,
    user
  }
}
