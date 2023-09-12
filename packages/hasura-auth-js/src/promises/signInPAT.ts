import { USER_ALREADY_SIGNED_IN } from '../errors'
import { AuthInterpreter } from '../machines'

import { AuthActionLoadingState, SessionActionHandlerResult } from './types'

export interface SignInPATHandlerResult extends SessionActionHandlerResult {}
export interface SignInPATState extends SignInPATHandlerResult, AuthActionLoadingState {}

export const signInPATPromise = (
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
        accessToken: null,
        refreshToken: null
      })
    }

    interpreter.onTransition((state) => {
      if (state.matches({ authentication: { signedOut: 'failed' } })) {
        return resolve({
          accessToken: null,
          refreshToken: null,
          user: null,
          error: state.context.errors.authentication || null,
          isError: true,
          isSuccess: false
        })
      }

      if (state.matches({ authentication: 'signedIn' })) {
        return resolve({
          accessToken: state.context.accessToken.value,
          refreshToken: state.context.refreshToken.value,
          user: state.context.user,
          error: null,
          isError: false,
          isSuccess: true
        })
      }
    })
  })
