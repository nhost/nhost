import { USER_UNAUTHENTICATED } from '../errors'
import { AuthInterpreter } from '../machines'

import { AuthActionErrorState, AuthActionLoadingState, AuthActionSuccessState } from './types'

export interface SignOutlessHandlerResult extends AuthActionErrorState, AuthActionSuccessState {}
export interface SignOutlessState extends SignOutlessHandlerResult, AuthActionLoadingState {}

export const signOutPromise = async (
  interpreter: AuthInterpreter,
  all?: boolean
): Promise<SignOutlessHandlerResult> =>
  new Promise<SignOutlessHandlerResult>((resolve) => {
    const { event } = interpreter.send('SIGNOUT', { all })
    if (event.type !== 'SIGNED_OUT') {
      return resolve({ isSuccess: false, isError: true, error: USER_UNAUTHENTICATED })
    }
    interpreter.onTransition((state) => {
      if (state.matches({ authentication: { signedOut: 'success' } })) {
        resolve({ isSuccess: true, isError: false, error: null })
      } else if (state.matches('authentication.signedOut.failed')) {
        resolve({ isSuccess: false, isError: true, error: state.context.errors.signout || null })
      }
    })
  })
