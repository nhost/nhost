import { USER_ALREADY_SIGNED_IN } from '../errors'
import { AuthInterpreter } from '../machines'
import { RequestOptions, SignUpOptions } from '../types'

import {
  AuthActionLoadingState,
  NeedsEmailVerificationState,
  SessionActionHandlerResult
} from './types'

export interface SignUpEmailPasswordHandlerResult
  extends SessionActionHandlerResult,
    NeedsEmailVerificationState {}

export interface SignUpEmailPasswordState
  extends SignUpEmailPasswordHandlerResult,
    AuthActionLoadingState {}

export const signUpEmailPasswordPromise = (
  interpreter: AuthInterpreter,
  email: string,
  password: string,
  options?: SignUpOptions,
  requestOptions?: RequestOptions
): Promise<SignUpEmailPasswordHandlerResult> =>
  new Promise<SignUpEmailPasswordHandlerResult>((resolve) => {
    const { changed, context } = interpreter.send('SIGNUP_EMAIL_PASSWORD', {
      email,
      password,
      options,
      requestOptions
    })
    if (!changed) {
      return resolve({
        error: USER_ALREADY_SIGNED_IN,
        accessToken: context.accessToken.value,
        refreshToken: context.refreshToken.value,
        isError: true,
        isSuccess: false,
        needsEmailVerification: false,
        user: context.user
      })
    }
    interpreter.onTransition((state) => {
      if (state.matches('registration.incomplete.failed')) {
        resolve({
          accessToken: null,
          refreshToken: null,
          error: state.context.errors.registration || null,
          isError: true,
          isSuccess: false,
          needsEmailVerification: false,
          user: null
        })
      } else if (
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
      } else if (state.matches({ authentication: 'signedIn', registration: 'complete' })) {
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
