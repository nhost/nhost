import { USER_ALREADY_SIGNED_IN } from '../errors'
import { AuthInterpreter } from '../machines'

import { ActionLoadingState, SessionActionHandlerResult } from './types'

export interface SignInAnonymousHandlerResult extends SessionActionHandlerResult {}
export interface SignInAnonymousState extends SignInAnonymousHandlerResult, ActionLoadingState {}

export const signInAnonymousPromise = (
  interpreter: AuthInterpreter
): Promise<SignInAnonymousHandlerResult> =>
  new Promise((resolve) => {
    const { changed } = interpreter.send('SIGNIN_ANONYMOUS')
    if (!changed) {
      resolve({
        isSuccess: false,
        isError: true,
        error: USER_ALREADY_SIGNED_IN,
        user: null,
        accessToken: null
      })
    }
    interpreter.onTransition((state) => {
      if (state.matches({ authentication: 'signedIn' })) {
        resolve({
          isSuccess: true,
          isError: false,
          error: null,
          user: state.context.user,
          accessToken: state.context.accessToken.value
        })
      }
      if (state.matches({ authentication: { signedOut: 'failed' } })) {
        resolve({
          isSuccess: false,
          isError: true,
          error: state.context.errors.authentication || null,
          user: null,
          accessToken: null
        })
      }
    })
  })
