import { AuthInterpreter, User } from '../types'

import { DefaultActionState } from './types'

interface SignInHookState extends DefaultActionState {
  user: User | null
  accessToken: string | null
}

interface SignInEmailPasswordState extends SignInHookState {
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
    interpreter.send('SIGNIN_PASSWORD', {
      email,
      password
    })
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
