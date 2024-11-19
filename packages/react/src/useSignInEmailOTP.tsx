import {
  SignInEmailOTPHandlerResult,
  signInEmailOTPPromise,
  SignInEmailOTPState,
  VerifyEmailOTPHandlerResult,
  verifyEmailOTPPromise
} from '@nhost/nhost-js'
import { useSelector } from '@xstate/react'
import { useState } from 'react'
import { useAuthInterpreter } from './useAuthInterpreter'

export interface SignInEmailOTPHandler {
  (email: string): Promise<SignInEmailOTPHandlerResult>
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
 * 1. The `signInEmailOTP` action sends a one-time password to the given email.
 * 3. After the code is received by email, the client sends the code with `verifyEmailOTP`. On success, the client is authenticated, and `isSuccess` equals `true`.
 *
 * Any error is monitored through `isError` and `error`. While the `signInEmailOTP` and `verifyEmailOTP` actions are running, `isLoading` equals `true`.
 *
 * @example
 * ```tsx
 * const { signInEmailOTP, verifyEmailOTP, isLoading, isSuccess, isError, error } = useSignInEmailOTP()
 *
 * console.log({ isLoading, isSuccess, isError, error });
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
export function useSignInEmailOTP(): SignInEmailOTPHookResult {
  const service = useAuthInterpreter()

  const signInEmailOTP: SignInEmailOTPHandler = (email: string) =>
    signInEmailOTPPromise(service, email)

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

  const isError = useSelector(service, (state) => state.matches('registration.incomplete.failed'))

  return { signInEmailOTP, verifyEmailOTP, isLoading, isSuccess, isError, error }
}
