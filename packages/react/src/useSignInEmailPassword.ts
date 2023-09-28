import {
  SignInEmailPasswordHandlerResult,
  signInEmailPasswordPromise,
  SignInEmailPasswordState,
  SignInMfaTotpHandlerResult,
  signInMfaTotpPromise
} from '@nhost/nhost-js'
import { useSelector } from '@xstate/react'
import { useAuthInterpreter } from './useAuthInterpreter'

interface SignInEmailPasswordHandler {
  (email: string, password: string): Promise<SignInEmailPasswordHandlerResult>
}

interface SendMfaOtpHander {
  (otp: string): Promise<SignInMfaTotpHandlerResult>
}

export interface SignInEmailPasswordHookResult extends SignInEmailPasswordState {
  signInEmailPassword: SignInEmailPasswordHandler
  sendMfaOtp: SendMfaOtpHander
}

interface SignInEmailPasswordHook {
  (): SignInEmailPasswordHookResult
}

// TODO: Add MFA example once MFA is available at Nhost Cloud.
/**
 * Use the hook `useSignInEmailPassword` to sign in a user using email and password.
 *
 * @example
 * ```tsx
 * const { signInEmailPassword, needsEmailVerification, isLoading, isSuccess, isError, error } = useSignInEmailPassword()
 *
 * console.log({ needsEmailVerification, isLoading, isSuccess, isError, error });
 *
 * const handleFormSubmit = async (e) => {
 *   e.preventDefault();
 *
 *   await signInEmailPassword('joe@example.com','secret-password')
 * }
 * ```
 *
 * @docs https://docs.nhost.io/reference/react/use-sign-in-email-password
 */
export const useSignInEmailPassword: SignInEmailPasswordHook = () => {
  const service = useAuthInterpreter()
  const signInEmailPassword: SignInEmailPasswordHandler = (email, password) =>
    signInEmailPasswordPromise(service, email, password)

  const sendMfaOtp: SendMfaOtpHander = (otp) => signInMfaTotpPromise(service, otp)

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
    (state) => state.matches({ authentication: { authenticating: 'password' } }),
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
  const needsMfaOtp = useSelector(
    service,
    (state) => state.matches({ authentication: { signedOut: 'needsMfa' } }),
    (a, b) => a === b
  )
  const isError = useSelector(
    service,
    (state) => state.matches({ authentication: { signedOut: 'failed' } }),
    (a, b) => a === b
  )

  const mfa = useSelector(service, (state) => state.context.mfa)

  return {
    accessToken,
    refreshToken,
    error,
    isError,
    isLoading,
    isSuccess,
    needsEmailVerification,
    needsMfaOtp,
    mfa,
    sendMfaOtp,
    signInEmailPassword,
    user
  }
}
