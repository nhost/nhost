import { USER_ALREADY_SIGNED_IN } from '../errors'
import { AuthInterpreter } from '../machines'

import {
  AuthActionLoadingState,
  NeedsEmailVerificationState,
  SessionActionHandlerResult
} from './types'

export interface SignInEmailPasswordHandlerResult
  extends SessionActionHandlerResult,
    NeedsEmailVerificationState {
  needsMfaOtp: boolean
  mfa: {
    ticket: string
  } | null
}

export interface SignInEmailPasswordState
  extends SignInEmailPasswordHandlerResult,
    AuthActionLoadingState {}

export const signInEmailPasswordPromise = (
  interpreter: AuthInterpreter,
  email: string,
  password: string
) =>
  new Promise<SignInEmailPasswordHandlerResult>((resolve) => {
    const { changed, context } = interpreter.send('SIGNIN_PASSWORD', {
      email,
      password
    })
    if (!changed) {
      return resolve({
        accessToken: context.accessToken.value,
        refreshToken: context.refreshToken.value,
        error: USER_ALREADY_SIGNED_IN,
        isError: true,
        isSuccess: false,
        needsEmailVerification: false,
        needsMfaOtp: false,
        mfa: null,
        user: context.user
      })
    }
    interpreter.onTransition((state) => {
      if (
        state.matches({
          authentication: { signedOut: 'noErrors' },
          registration: { incomplete: 'needsEmailVerification' }
        })
      ) {
        resolve({
          accessToken: null,
          refreshToken: null,
          error: null,
          isError: false,
          isSuccess: false,
          needsEmailVerification: true,
          needsMfaOtp: false,
          mfa: null,
          user: null
        })
      } else if (state.matches({ authentication: { signedOut: 'needsMfa' } })) {
        resolve({
          accessToken: null,
          refreshToken: null,
          error: null,
          isError: false,
          isSuccess: false,
          needsEmailVerification: false,
          needsMfaOtp: true,
          mfa: state.context.mfa,
          user: null
        })
      } else if (state.matches({ authentication: { signedOut: 'failed' } })) {
        resolve({
          accessToken: null,
          refreshToken: null,
          error: state.context.errors.authentication || null,
          isError: true,
          isSuccess: false,
          needsEmailVerification: false,
          needsMfaOtp: false,
          mfa: null,
          user: null
        })
      } else if (state.matches({ authentication: 'signedIn' })) {
        resolve({
          accessToken: state.context.accessToken.value,
          refreshToken: state.context.refreshToken.value,
          error: null,
          isError: false,
          isSuccess: true,
          needsEmailVerification: false,
          needsMfaOtp: false,
          mfa: null,
          user: state.context.user
        })
      }
    })
  })
