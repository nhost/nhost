import { USER_ALREADY_SIGNED_IN } from '../errors'
import { AuthInterpreter } from '../machines'
import { PasswordlessOptions } from '../types'

import { AuthActionErrorState, AuthActionLoadingState, AuthActionSuccessState } from './types'
export interface SignInEmailPasswordlessHandlerResult
  extends AuthActionErrorState,
    AuthActionSuccessState {}
export interface SignInEmailPasswordlessState
  extends SignInEmailPasswordlessHandlerResult,
    AuthActionLoadingState {}

export const signInEmailPasswordlessPromise = (
  interpreter: AuthInterpreter,
  email: string,
  options?: PasswordlessOptions
) =>
  new Promise<SignInEmailPasswordlessHandlerResult>((resolve) => {
    const { changed } = interpreter.send('PASSWORDLESS_EMAIL', {
      email,
      options
    })
    if (!changed) {
      return resolve({
        error: USER_ALREADY_SIGNED_IN,
        isError: true,
        isSuccess: false
      })
    }
    interpreter.onTransition((state) => {
      if (state.matches('registration.incomplete.failed')) {
        resolve({
          error: state.context.errors.registration || null,
          isError: true,
          isSuccess: false
        })
      } else if (
        state.matches({
          authentication: { signedOut: 'noErrors' },
          registration: { incomplete: 'needsEmailVerification' }
        })
      ) {
        resolve({ error: null, isError: false, isSuccess: true })
      }
    })
  })
