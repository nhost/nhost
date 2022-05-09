import { User } from '@nhost/core'
import { useSelector } from '@xstate/vue'
import { DefaultActionComposableState } from './types'

import { useAuthenticated } from './useAuthenticated'
import { useAuthInterpreter } from './useAuthInterpreter'
import { useError } from './useError'

interface SignInAnonymousComposableState extends DefaultActionComposableState {
  user: User | null
  accessToken: string | null
}

type SignInAnonymousComposableStateHandlerResult = Omit<SignInAnonymousComposableState, 'isLoading'>

// TODO documentation when available in Nhost Cloud - see changelog
// TODO deanonymize
// TODO review nhost.auth.signIn()
/** @internal not ready yet */
export const useSignInAnonymous = () => {
  const service = useAuthInterpreter()
  const signInAnonymous = (): Promise<SignInAnonymousComposableStateHandlerResult> =>
    new Promise((resolve) => {
      const { changed } = service.value.send('SIGNIN_ANONYMOUS')
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
      service.value.onTransition((state) => {
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

  const error = useError('authentication')

  const isLoading = useSelector(service.value, (state) =>
    state.matches({ authentication: { authenticating: 'anonymous' } })
  )

  const isSuccess = useAuthenticated()

  const isError = useSelector(service.value, (state) =>
    state.matches({ authentication: { signedOut: 'failed' } })
  )

  return { signInAnonymous, isLoading, isSuccess, isError, error }
}
