import { AuthInterpreter, User } from '../types'

import { DefaultActionState } from './types'

interface SignInAnonymousState extends DefaultActionState {
  user: User | null
  accessToken: string | null
}

type SignInAnonymousHandlerResult = Omit<SignInAnonymousState, 'isLoading'>

export const signInAnonymousPromise = (
  interpreter: AuthInterpreter
): Promise<SignInAnonymousHandlerResult> =>
  new Promise((resolve) => {
    const { changed } = interpreter.send('SIGNIN_ANONYMOUS')
    if (!changed) {
      resolve({
        isSuccess: false,
        isError: true,
        // TODO error
        error: null,
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
