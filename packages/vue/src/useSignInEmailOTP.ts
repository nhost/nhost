import {
  SignInEmailOTPHandlerResult,
  signInEmailOTPPromise,
  SignInEmailOTPState,
  VerifyEmailOTPHandlerResult,
  verifyEmailOTPPromise
} from '@nhost/nhost-js'
import { useSelector } from '@xstate/vue'
import { ref, ToRefs, unref } from 'vue'
import { NestedRefOfValue, nestedUnref, RefOrValue } from './helpers'
import { useAuthInterpreter } from './useAuthInterpreter'

export interface SignInEmailOTPHandler {
  (email: RefOrValue<string>): Promise<SignInEmailOTPHandlerResult>
}

export interface VerifyEmailOTPHandler {
  (email: RefOrValue<string>, code: RefOrValue<string>): Promise<VerifyEmailOTPHandlerResult>
}

export interface SignEmailOTPComposableResult extends ToRefs<SignInEmailOTPState> {
  signInEmailOTP: SignInEmailOTPHandler
  verifyEmailOTP: VerifyEmailOTPHandler
}

/**
 * Use the composable `useSignInSmsPasswordless` to sign in a user with a one-time password sent via SMS to a phone.
 *
 * 1. The `signInSmsPasswordless` action sends a one-time password to the given phone number.
 * 2. The client is then awaiting the OTP. `needsOtp` equals true.
 * 3. After the code is received by SMS, the client sends the code with `sendOtp`. On success, the client is authenticated, and `isSuccess` equals `true`.
 *
 * Any error is monitored through `isError` and `error`. While the `signInSmsPasswordless` and `sendOtp` actions are running, `isLoading` equals `true`.
 *
 * @example
 * ```tsx
 * const { signInSmsPasswordless, sendOtp, needsOtp, isLoading, isSuccess, isError, error } = useSignInSmsPasswordless()
 *
 * console.log({ isLoading, isSuccess, isError, error });
 *
 * const askCode = async (e) => {
 *   e.preventDefault();
 *   await signInSmsPasswordless('+32455555555');
 * }
 *
 * const sendCode = async (e) => {
 *   e.preventDefault();
 *   await sendOtp('123456');
 * }
 * ```
 *
 * @docs https://docs.nhost.io/reference/vue/use-sign-in-email-otp
 */
export function useSignInEmailOTP(): SignEmailOTPComposableResult {
  const service = useAuthInterpreter()

  const signInEmailOTP: SignInEmailOTPHandler = (email: RefOrValue<string>) => {
    return signInEmailOTPPromise(service.value, unref(email))
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
