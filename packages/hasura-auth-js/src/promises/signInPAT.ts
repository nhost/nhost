import { USER_ALREADY_SIGNED_IN } from '../errors'
import { AuthInterpreter } from '../machines'

import { AuthActionLoadingState, SessionActionHandlerResult } from './types'

export interface SignInPATHandlerResult extends SessionActionHandlerResult {}
export interface SignInPATState extends SignInPATHandlerResult, AuthActionLoadingState {}

export const signInPatPromise = (
  interpreter: AuthInterpreter,
  pat: string
): Promise<SignInPATHandlerResult> =>
  new Promise((resolve) => {
    const { changed } = interpreter.send('SIGNIN_PAT', { pat })
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
