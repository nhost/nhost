import { USER_ALREADY_SIGNED_IN } from '../errors'
import { AuthInterpreter, PasswordlessOptions } from '../types'

import { ActionErrorState, ActionSuccessState } from './types'
export interface SignInEmailPasswordlessHandlerResult
  extends ActionErrorState,
    ActionSuccessState {}

export const signInEmailPasswordlessPromise = (
  interpreter: AuthInterpreter,
  email: string,
  options?: PasswordlessOptions
) =>
  new Promise<SignInEmailPasswordlessHandlerResult>((resolve) => {
    const { changed } = interpreter.send('SIGNIN_PASSWORDLESS_EMAIL', {
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
      if (state.matches({ authentication: { signedOut: 'failed' } })) {
        resolve({
          error: state.context.errors.authentication || null,
          isError: true,
          isSuccess: false
        })
      } else if (
        state.matches({
          authentication: { signedOut: 'noErrors' },
          email: 'awaitingVerification'
        })
      ) {
        resolve({ error: null, isError: false, isSuccess: true })
      }
    })
  })
