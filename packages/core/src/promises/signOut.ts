import { ErrorPayload, USER_UNAUTHENTICATED } from '../errors'
import { AuthInterpreter } from '../types'

export const signOutPromise = async (interpreter: AuthInterpreter, all?: boolean) =>
  new Promise<{ isSuccess: boolean; error: ErrorPayload | null; isError: boolean }>((resolve) => {
    const { event } = interpreter.send({
      type: 'SIGNOUT',
      all
    })
    if (event.type !== 'SIGNED_OUT') {
      return resolve({ isSuccess: false, isError: true, error: USER_UNAUTHENTICATED })
    }
    interpreter.onTransition((state) => {
      if (state.matches({ authentication: { signedOut: 'success' } })) {
        resolve({ isSuccess: true, isError: false, error: null })
      } else if (state.matches({ authentication: { signedOut: { failed: 'server' } } }))
        resolve({ isSuccess: false, isError: true, error: state.context.errors.signout || null })
    })
  })
