import {
  EmailOTPOptions,
  SignInEmailOTPHandlerResult,
  signInEmailOTPPromise,
  SignInEmailOTPState,
  VerifyEmailOTPHandlerResult,
  verifyEmailOTPPromise
} from '@nhost/nhost-js'
import { useSelector } from '@xstate/react'
import { useAuthInterpreter } from './useAuthInterpreter'

export interface SignInEmailOTPHandler {
  (email: string, options?: EmailOTPOptions): Promise<SignInEmailOTPHandlerResult>
}

export interface VerifyEmailOTPHandler {
  (email: string, otp: string): Promise<VerifyEmailOTPHandlerResult>
}

export interface SignInEmailOTPHookResult extends SignInEmailOTPState {
  signInEmailOTP: SignInEmailOTPHandler
  verifyEmailOTP: VerifyEmailOTPHandler
}

/**
 * Use the hook `useSignInEmailOTP` to sign in a user with a one-time password sent via email.
 *
 * ## Usage
 *
 * 1. Call the `signInEmailOTP` function with the user's email to send a one-time password (OTP) to that email address.
 * 2. The state `needsOtp` will be `true`, indicating that an OTP is required.
 * 3. Once the user receives the OTP via email, call the `verifyEmailOTP` function with the email and the received OTP.
 * 4. On successful verification, the user is authenticated, and `isSuccess` becomes `true`.
 *
 * Any error is monitored through `isError` and `error`. While the `signInEmailOTP` and `verifyEmailOTP` actions are running, `isLoading` equals `true`.
 *
 * @example
 * ```tsx
 * const { signInEmailOTP, verifyEmailOTP, isLoading, isSuccess, isError, error } = useSignInEmailOTP()
 *
 * const signIn = async (e) => {
 *   e.preventDefault();
 *   await signInEmailOTP('john@gmail.com');
 * }
 *
 * const verify = async (e) => {
 *   e.preventDefault();
 *   await verifyEmailOTP('123456');
 * }
 * ```
 *
 * @docs https://docs.nhost.io/reference/react/use-sign-in-email-otp
 */
export function useSignInEmailOTP(options?: EmailOTPOptions): SignInEmailOTPHookResult {
  const service = useAuthInterpreter()

  const signInEmailOTP: SignInEmailOTPHandler = (email: string, overrideOptions = options) =>
    signInEmailOTPPromise(service, email, overrideOptions)

  const verifyEmailOTP: VerifyEmailOTPHandler = async (email: string, otp: string) =>
    verifyEmailOTPPromise(service, email, otp)

  const error = useSelector(
    service,
    (state) => state.context.errors.registration || null,
    (a, b) => a?.error === b?.error
  )
  const isLoading = useSelector(
    service,
    (state) =>
      state.matches('registration.signInEmailOTP') || state.matches('registration.verifyEmailOTP')
  )

  const isSuccess = useSelector(service, (state) => state.matches('authentication.signedIn'))

  const needsOtp = useSelector(service, (state) =>
    state.matches('registration.incomplete.needsOtp')
  )

  const isError = useSelector(service, (state) => state.matches('registration.incomplete.failed'))

  return { signInEmailOTP, verifyEmailOTP, isLoading, isSuccess, isError, error, needsOtp }
}
