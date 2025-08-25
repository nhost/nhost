import {
  PasswordlessOptions,
  SignInSmsPasswordlessHandlerResult,
  SignInSmsPasswordlessOtpHandlerResult,
  signInSmsPasswordlessOtpPromise,
  signInSmsPasswordlessPromise,
  SignInSmsPasswordlessState
} from '@nhost/nhost-js'
import { useSelector } from '@xstate/react'
import { useState } from 'react'
import { useAuthInterpreter } from './useAuthInterpreter'

export interface SignInSmsPasswordlessHandler {
  (phoneNumber: string, options?: PasswordlessOptions): Promise<SignInSmsPasswordlessHandlerResult>
}

export interface SignInSmsPasswordlessOtpHandler {
  (code: string): Promise<SignInSmsPasswordlessOtpHandlerResult>
  (phoneNumber: string, code: string): Promise<SignInSmsPasswordlessOtpHandlerResult>
}

export interface SignInSmsPasswordlessHookResult extends SignInSmsPasswordlessState {
  /** Sends a one-time code to the given phoneNumber */
  signInSmsPasswordless: SignInSmsPasswordlessHandler
  sendOtp: SignInSmsPasswordlessOtpHandler
}

/**
 * Use the hook `useSignInSmsPasswordless` to sign in a user with a one-time password sent via SMS to a phone.
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
 * @docs https://docs.nhost.io/reference/react/use-sign-in-sms-passwordless
 */
export function useSignInSmsPasswordless(
  stateOptions?: PasswordlessOptions
): SignInSmsPasswordlessHookResult {
  const service = useAuthInterpreter()
  const [_phoneNumber, setPhoneNumber] = useState('')

  const signInSmsPasswordless: SignInSmsPasswordlessHandler = (
    phoneNumber: string,
    valueOptions = stateOptions
  ) => {
    setPhoneNumber(phoneNumber)
    return signInSmsPasswordlessPromise(service, phoneNumber, valueOptions)
  }

  const sendOtp: SignInSmsPasswordlessOtpHandler = async (...args: string[]) => {
    if (args.length === 2) {
      const [phoneNumber, code] = args
      return signInSmsPasswordlessOtpPromise(service, phoneNumber, code)
    }
    const [code] = args
    return signInSmsPasswordlessOtpPromise(service, _phoneNumber, code)
  }

  const error = useSelector(
    service,
    (state) => state.context.errors.registration || null,
    (a, b) => a?.error === b?.error
  )
  const isLoading = useSelector(
    service,
    (state) =>
      state.matches('registration.passwordlessSms') ||
      state.matches('registration.passwordlessSmsOtp')
  )

  const isSuccess = useSelector(service, (state) => state.matches('authentication.signedIn'))

  const needsOtp = useSelector(service, (state) =>
    state.matches('registration.incomplete.needsOtp')
  )

  const isError = useSelector(service, (state) => state.matches('registration.incomplete.failed'))

  return { signInSmsPasswordless, sendOtp, isLoading, isSuccess, needsOtp, isError, error }
}
