import { USER_ALREADY_SIGNED_IN } from '../errors'
import { AuthInterpreter } from '../machines'

import { AuthActionLoadingState, SessionActionHandlerResult } from './types'

export interface SignInSmsPasswordlessOtpHandlerResult extends SessionActionHandlerResult {}
export interface SignInSmsPasswordlessOtpState
  extends SignInSmsPasswordlessOtpHandlerResult,
    AuthActionLoadingState {}

export const signInSmsPasswordlessOtpPromise = (
  interpreter: AuthInterpreter,
  phoneNumber: string,
  otp: string
) =>
  new Promise<SignInSmsPasswordlessOtpHandlerResult>((resolve) => {
    const { changed } = interpreter.send({ type: 'PASSWORDLESS_SMS_OTP', phoneNumber, otp })
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
