import { USER_ALREADY_SIGNED_IN } from '../errors'
import { AuthInterpreter, PasswordlessOptions } from '../types'

import { ActionErrorState, ActionLoadingState, ActionSuccessState } from './types'

export interface SignInSmsPasswordlessHandlerResult extends ActionErrorState, ActionSuccessState {
  needsOtp: boolean
}
export interface SignInSmsPasswordlessState
  extends SignInSmsPasswordlessHandlerResult,
    ActionLoadingState {}

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
