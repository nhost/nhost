import { signInAnonymousPromise } from '@nhost/core'
import { useSelector } from '@xstate/vue'

import { useAuthenticated } from './useAuthenticated'
import { useAuthInterpreter } from './useAuthInterpreter'
import { useError } from './useError'

// TODO documentation when available in Nhost Cloud
/** @internal not ready yet */
export const useSignInAnonymous = () => {
  const service = useAuthInterpreter()
  const signInAnonymous = () => signInAnonymousPromise(service.value)

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
