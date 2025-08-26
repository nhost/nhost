import { USER_ALREADY_SIGNED_IN } from '../errors'
import { AuthInterpreter } from '../machines'
import { PasswordlessOptions } from '../types'

import { AuthActionErrorState, AuthActionLoadingState, AuthActionSuccessState } from './types'

export interface SignInSmsPasswordlessState
  extends SignInSmsPasswordlessHandlerResult,
    AuthActionLoadingState {}

export interface SignInSmsPasswordlessHandlerResult
  extends AuthActionErrorState,
    AuthActionSuccessState {
  /**
   * Returns true when the one-time password has been sent over by SMS, and the user needs to send it back to complete sign-in.
   */
  needsOtp: boolean
}

export const signInSmsPasswordlessPromise = (
  interpreter: AuthInterpreter,
  phoneNumber: string,
  options?: PasswordlessOptions
) =>
  new Promise<SignInSmsPasswordlessHandlerResult>((resolve) => {
    const { changed } = interpreter.send('PASSWORDLESS_SMS', { phoneNumber, options })
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
          isSuccess: false,
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
