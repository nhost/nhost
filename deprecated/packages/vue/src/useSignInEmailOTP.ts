import {
  EmailOTPOptions,
  SignInEmailOTPHandlerResult,
  signInEmailOTPPromise,
  SignInEmailOTPState,
  VerifyEmailOTPHandlerResult,
  verifyEmailOTPPromise
} from '@nhost/nhost-js'
import { useSelector } from '@xstate/vue'
import { ToRefs, unref } from 'vue'
import { NestedRefOfValue, nestedUnref, RefOrValue } from './helpers'
import { useAuthInterpreter } from './useAuthInterpreter'

export interface SignInEmailOTPHandler {
  (
    email: RefOrValue<string>,
    options?: NestedRefOfValue<EmailOTPOptions | undefined>
  ): Promise<SignInEmailOTPHandlerResult>
}

export interface VerifyEmailOTPHandler {
  (email: RefOrValue<string>, code: RefOrValue<string>): Promise<VerifyEmailOTPHandlerResult>
}

export interface SignEmailOTPComposableResult extends ToRefs<SignInEmailOTPState> {
  signInEmailOTP: SignInEmailOTPHandler
  verifyEmailOTP: VerifyEmailOTPHandler
}

/**
 * Use the `useSignInEmailOTP` composable to sign in a user with a one-time password sent via email.
 *
 * ## Usage
 *
 * 1. Call the `signInEmailOTP` function with the user's email to send a one-time password (OTP) to that email address.
 * 2. The state `needsOtp` will be `true`, indicating that an OTP is required.
 * 3. Once the user receives the OTP via email, call the `verifyEmailOTP` function with the email and the received OTP.
 * 4. On successful verification, the user is authenticated, and `isSuccess` becomes `true`.
 *
 * Any errors during the sign-in or verification process are tracked using `isError` and `error`. While the `signInEmailOTP` and `verifyEmailOTP` actions are in progress, `isLoading` is `true`.
 *
 * ## Example
 * ```ts
 * const {
 *   signInEmailOTP,
 *   verifyEmailOTP,
 *   error
 * } = useSignInEmailOTP()
 *
 * const requestOtp = async (e: Event) => {
 *   e.preventDefault()
 *   await signInEmailOTP(email.value)
 * }
 *
 * const confirmOtp = async (e: Event) => {
 *   e.preventDefault()
 *   await verifyEmailOTP(email.value, otp.value)
 * }
 *
 * ```
 *
 * @docs https://docs.nhost.io/reference/vue/use-sign-in-email-otp
 */
export function useSignInEmailOTP(
  options?: NestedRefOfValue<EmailOTPOptions | undefined>
): SignEmailOTPComposableResult {
  const service = useAuthInterpreter()

  const signInEmailOTP: SignInEmailOTPHandler = (
    email: RefOrValue<string>,
    overrideOptions = options
  ) => {
    return signInEmailOTPPromise(service.value, unref(email), nestedUnref(overrideOptions))
  }

  const verifyEmailOTP: VerifyEmailOTPHandler = async (
    email: RefOrValue<string>,
    otp: RefOrValue<string>
  ) => {
    return verifyEmailOTPPromise(service.value, unref(email), unref(otp))
  }

  const error = useSelector(
    service.value,
    (state) => state.context.errors.registration || null,
    (a, b) => a?.error === b?.error
  )
  const isLoading = useSelector(
    service.value,
    (state) =>
      state.matches('registration.signInEmailOTP') || state.matches('registration.verifyEmailOTP')
  )

  const isSuccess = useSelector(service.value, (state) => state.matches('authentication.signedIn'))

  const needsOtp = useSelector(service.value, (state) =>
    state.matches('registration.incomplete.needsOtp')
  )

  const isError = useSelector(service.value, (state) =>
    state.matches('registration.incomplete.failed')
  )

  return { signInEmailOTP, verifyEmailOTP, needsOtp, isLoading, isSuccess, isError, error }
}
