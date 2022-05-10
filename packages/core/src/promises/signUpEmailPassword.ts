import { USER_ALREADY_SIGNED_IN } from '../errors'
import { AuthInterpreter, SignUpOptions, User } from '../types'

import { DefaultActionState } from './types'

export interface SignUpEmailPasswordState extends DefaultActionState {
  needsEmailVerification: boolean
  /** User information */
  user: User | null
  /** Access token (JWT) */
  accessToken: string | null
}

export type SignUpEmailPasswordHandlerResult = Omit<SignUpEmailPasswordState, 'isLoading'>

export const signUpEmailPasswordPromise = (
  interpreter: AuthInterpreter,
  email: string,
  password: string,
  options?: SignUpOptions
): Promise<SignUpEmailPasswordHandlerResult> =>
  new Promise<SignUpEmailPasswordHandlerResult>((resolve) => {
    const { changed, context } = interpreter.send({
      type: 'SIGNUP_EMAIL_PASSWORD',
      email,
      password,
      options
    })
    if (!changed) {
      return resolve({
        error: USER_ALREADY_SIGNED_IN,
        accessToken: context.accessToken.value,
        isError: true,
        isSuccess: false,
        needsEmailVerification: false,
        user: context.user
      })
    }
    interpreter.onTransition((state) => {
      if (state.matches({ authentication: { signedOut: 'failed' } })) {
        resolve({
          accessToken: null,
          error: state.context.errors.registration || null,
          isError: true,
          isSuccess: false,
          needsEmailVerification: false,
          user: null
        })
      } else if (
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
          user: null
        })
      } else if (state.matches({ authentication: 'signedIn' })) {
        resolve({
          accessToken: state.context.accessToken.value,
          error: null,
          isError: false,
          isSuccess: true,
          needsEmailVerification: false,
          user: state.context.user
        })
      }
    })
  })
