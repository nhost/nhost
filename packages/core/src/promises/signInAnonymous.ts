import { INVALID_AUTHENTICATION_METHOD } from '../errors'
import { AuthInterpreter } from '../types'

import { SessionActionHandlerResult } from './types'

type SignInAnonymousHandlerResult = SessionActionHandlerResult

export const signInAnonymousPromise = (
  interpreter: AuthInterpreter
): Promise<SignInAnonymousHandlerResult> =>
  new Promise((resolve) => {
    const { changed } = interpreter.send('SIGNIN_ANONYMOUS')
    if (!changed) {
      resolve({
        isSuccess: false,
        isError: true,
        error: INVALID_AUTHENTICATION_METHOD,
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
