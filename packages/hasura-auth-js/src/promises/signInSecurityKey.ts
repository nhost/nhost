import { USER_ALREADY_SIGNED_IN } from '../errors'
import { AuthInterpreter } from '../machines'

import {
  AuthActionLoadingState,
  NeedsEmailVerificationState,
  SessionActionHandlerResult
} from './types'

export interface SignInSecurityKeyHandlerResult
  extends SessionActionHandlerResult,
    NeedsEmailVerificationState {}

export interface SignInSecurityKeyState
  extends SignInSecurityKeyHandlerResult,
    AuthActionLoadingState {}

export const signInSecurityKeyPromise = (interpreter: AuthInterpreter) =>
  new Promise<SignInSecurityKeyHandlerResult>((resolve) => {
    const { changed, context } = interpreter.send({ type: 'SIGNIN_SECURITY_KEY' })
    if (!changed) {
      return resolve({
        accessToken: context.accessToken.value,
        refreshToken: context.refreshToken.value,
        error: USER_ALREADY_SIGNED_IN,
        isError: true,
        isSuccess: false,
        needsEmailVerification: false,
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
          user: state.context.user
        })
      }
    })
  })
