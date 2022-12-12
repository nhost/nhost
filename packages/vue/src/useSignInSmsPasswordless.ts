import {
  PasswordlessOptions,
  SignInSmsPasswordlessHandlerResult,
  SignInSmsPasswordlessOtpHandlerResult,
  signInSmsPasswordlessOtpPromise,
  signInSmsPasswordlessPromise,
  SignInSmsPasswordlessState
} from '@nhost/nhost-js'
import { useSelector } from '@xstate/vue'
import { ref, ToRefs, unref } from 'vue'
import { NestedRefOfValue, nestedUnref, RefOrValue } from './helpers'
import { useAuthInterpreter } from './useAuthInterpreter'

export interface SignInSmsPasswordlessHandler {
  (
    phoneNumber: RefOrValue<string>,
    options?: NestedRefOfValue<PasswordlessOptions | undefined>
  ): Promise<SignInSmsPasswordlessHandlerResult>
}

export interface SignInSmsPasswordlessOtpHandler {
  (code: RefOrValue<string>): Promise<SignInSmsPasswordlessOtpHandlerResult>
  (
    phoneNumber: RefOrValue<string>,
    code: RefOrValue<string>
  ): Promise<SignInSmsPasswordlessOtpHandlerResult>
}

export interface SignInSmsPasswordlessComposableResult extends ToRefs<SignInSmsPasswordlessState> {
  /** Sends a one-time code to the given phoneNumber */
  signInSmsPasswordless: SignInSmsPasswordlessHandler
  sendOtp: SignInSmsPasswordlessOtpHandler
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
 * @docs https://docs.nhost.io/reference/vue/use-sign-in-sms-passwordless
 */
export function useSignInSmsPasswordless(
  stateOptions?: NestedRefOfValue<PasswordlessOptions | undefined>
): SignInSmsPasswordlessComposableResult {
  const service = useAuthInterpreter()
  const _phoneNumber = ref('')

  const signInSmsPasswordless: SignInSmsPasswordlessHandler = (
    phoneNumber: RefOrValue<string>,
    valueOptions = stateOptions
  ) => {
    _phoneNumber.value = unref(phoneNumber)
    return signInSmsPasswordlessPromise(
      service.value,
      unref(phoneNumber),
      nestedUnref(valueOptions)
    )
  }

  const sendOtp: SignInSmsPasswordlessOtpHandler = async (...args: Array<RefOrValue<string>>) => {
    if (args.length === 2) {
      const [phoneNumber, code] = args
      return signInSmsPasswordlessOtpPromise(service.value, unref(phoneNumber), unref(code))
    }
    const [code] = args
    return signInSmsPasswordlessOtpPromise(service.value, unref(_phoneNumber), unref(code))
  }

  const error = useSelector(
    service.value,
    (state) => state.context.errors.registration || null,
    (a, b) => a?.error === b?.error
  )
  const isLoading = useSelector(
    service.value,
    (state) =>
      state.matches('registration.passwordlessSms') ||
      state.matches('registration.passwordlessSmsOtp')
  )

  const isSuccess = useSelector(service.value, (state) => state.matches('authentication.signedIn'))

  const needsOtp = useSelector(service.value, (state) =>
    state.matches('registration.incomplete.needsOtp')
  )

  const isError = useSelector(service.value, (state) =>
    state.matches('registration.incomplete.failed')
  )

  return { signInSmsPasswordless, sendOtp, isLoading, isSuccess, needsOtp, isError, error }
}
