import { USER_ALREADY_SIGNED_IN } from '../errors'
import { AuthInterpreter, User } from '../types'

import { DefaultActionState } from './types'

export interface SignInState extends DefaultActionState {
  user: User | null
  accessToken: string | null
}

export interface SignInEmailPasswordState extends SignInState {
  needsMfaOtp: boolean
  needsEmailVerification: boolean
}
export type SignInEmailPasswordHandlerResult = Omit<SignInEmailPasswordState, 'isLoading'>

export const signInEmailPasswordPromise = (
  interpreter: AuthInterpreter,
  email: string,
  password: string
) =>
  new Promise<SignInEmailPasswordHandlerResult>((resolve) => {
    const { changed, context } = interpreter.send('SIGNIN_PASSWORD', {
      email,
      password
    })
    if (!changed) {
      return resolve({
        accessToken: context.accessToken.value,
        error: USER_ALREADY_SIGNED_IN,
        isError: true,
        isSuccess: false,
        needsEmailVerification: false,
        needsMfaOtp: false,
        user: context.user
      })
    }
    interpreter.onTransition((state) => {
      if (
        state.matches({
          authentication: { signedOut: 'noErrors' },
          email: 'awaitingVerification'
        })
      ) {
        resolve({
          accessToken: null,
          error: null,
          isError: false,
          isSuccess: false,
          needsEmailVerification: true,
          needsMfaOtp: false,
          user: null
        })
      } else if (state.matches({ authentication: { signedOut: 'needsMfa' } })) {
        resolve({
          accessToken: null,
          error: null,
          isError: false,
          isSuccess: false,
          needsEmailVerification: false,
          needsMfaOtp: true,
          user: null
        })
      } else if (state.matches({ authentication: { signedOut: 'failed' } })) {
        resolve({
          accessToken: null,
          error: state.context.errors.authentication || null,
          isError: true,
          isSuccess: false,
          needsEmailVerification: false,
          needsMfaOtp: false,
          user: null
        })
      } else if (state.matches({ authentication: 'signedIn' })) {
        resolve({
          accessToken: state.context.accessToken.value,
          error: null,
          isError: false,
          isSuccess: true,
          needsEmailVerification: false,
          needsMfaOtp: false,
          user: state.context.user
        })
      }
    })
  })
