import { USER_ALREADY_SIGNED_IN } from '../errors'
import { AuthInterpreter } from '../machines'

import { AuthActionLoadingState, SessionActionHandlerResult } from './types'

export interface SignInMfaTotpHandlerResult extends SessionActionHandlerResult {}

export interface SignInMfaTotpState extends SignInMfaTotpHandlerResult, AuthActionLoadingState {}

export const signInMfaTotpPromise = (interpreter: AuthInterpreter, otp: string, ticket?: string) =>
  new Promise<SignInMfaTotpHandlerResult>((resolve) => {
    const { changed, context } = interpreter.send('SIGNIN_MFA_TOTP', {
      otp,
      ticket
    })
    if (!changed) {
      return resolve({
        accessToken: context.accessToken.value,
        refreshToken: context.refreshToken.value,
        error: USER_ALREADY_SIGNED_IN,
        isError: true,
        isSuccess: false,
        user: context.user,
        elevated: false
      })
    }
    interpreter.onTransition((state) => {
      if (state.matches({ authentication: { signedOut: 'failed' } })) {
        resolve({
          accessToken: null,
          refreshToken: null,
          error: state.context.errors.authentication || null,
          isError: true,
          isSuccess: false,
          user: null,
          elevated: false
        })
      } else if (state.matches({ authentication: 'signedIn' })) {
        resolve({
          accessToken: state.context.accessToken.value,
          refreshToken: state.context.refreshToken.value,
          error: null,
          isError: false,
          isSuccess: true,
          user: state.context.user,
          elevated: false
        })
      }
    })
  })
