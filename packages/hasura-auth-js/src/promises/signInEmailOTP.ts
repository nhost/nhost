import { USER_ALREADY_SIGNED_IN } from '../errors'
import { AuthInterpreter } from '../machines'
import { EmailOTPOptions } from '../types'

import {
  AuthActionErrorState,
  AuthActionLoadingState,
  AuthActionSuccessState,
  SessionActionHandlerResult
} from './types'

export interface SignInEmailOTPHandlerResult extends AuthActionErrorState, AuthActionSuccessState {
  /**
   * Returns true when the one-time password has been sent via email, and the user needs to send it back to complete sign-in.
   */
  needsOtp: boolean
}

export interface SignInEmailOTPState extends SignInEmailOTPHandlerResult, AuthActionLoadingState {}

export interface VerifyEmailOTPHandlerResult extends SessionActionHandlerResult {}

export const signInEmailOTPPromise = (
  interpreter: AuthInterpreter,
  email: string,
  options?: EmailOTPOptions
) =>
  new Promise<SignInEmailOTPHandlerResult>((resolve) => {
    const { changed } = interpreter.send('SIGNIN_EMAIL_OTP', { email, options })

    if (!changed) {
      return resolve({
        error: USER_ALREADY_SIGNED_IN,
        isError: true,
        isSuccess: false,
        needsOtp: false
      })
    }

    interpreter.onTransition((state) => {
      if (state.matches('registration.incomplete.needsOtp')) {
        resolve({
          error: null,
          isError: false,
          isSuccess: true,
          needsOtp: true
        })
      } else if (state.matches('registration.incomplete.failed')) {
        resolve({
          error: state.context.errors.authentication || null,
          isError: true,
          isSuccess: false,
          needsOtp: false
        })
      }
    })
  })

export const verifyEmailOTPPromise = (interpreter: AuthInterpreter, email: string, otp: string) =>
  new Promise<VerifyEmailOTPHandlerResult>((resolve) => {
    const { changed } = interpreter.send({ type: 'VERIFY_EMAIL_OTP', email, otp })

    if (!changed) {
      return resolve({
        error: USER_ALREADY_SIGNED_IN,
        isError: true,
        isSuccess: false,
        user: null,
        accessToken: null,
        refreshToken: null
      })
    }
    interpreter.onTransition((state) => {
      if (state.matches({ authentication: 'signedIn' })) {
        resolve({
          error: null,
          isError: false,
          isSuccess: true,
          user: state.context.user,
          accessToken: state.context.accessToken.value,
          refreshToken: state.context.refreshToken.value
        })
      } else if (state.matches({ registration: { incomplete: 'failed' } })) {
        resolve({
          error: state.context.errors.authentication || null,
          isError: true,
          isSuccess: false,
          user: null,
          accessToken: null,
          refreshToken: null
        })
      }
    })
  })
