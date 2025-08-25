import { USER_ALREADY_SIGNED_IN } from '../errors'
import { AuthInterpreter } from '../machines'
import { Provider } from '../types'

import { AuthActionLoadingState, SessionActionHandlerResult } from './types'

export interface SignInIdTokenHandlerParams {
  provider: Provider
  idToken: string
  nonce?: string
}

export interface SignInIdTokenHandlerResult extends SessionActionHandlerResult {}
export interface SignInIdTokenState extends SignInIdTokenHandlerResult, AuthActionLoadingState {}

export const signInIdTokenPromise = (
  interpreter: AuthInterpreter,
  { provider, idToken, nonce }: SignInIdTokenHandlerParams
): Promise<SignInIdTokenHandlerResult> =>
  new Promise((resolve) => {
    const { changed } = interpreter.send('SIGNIN_ID_TOKEN', {
      provider,
      idToken,
      ...(nonce && { nonce })
    })

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
