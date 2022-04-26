import { useSelector } from '@xstate/vue'

import { useAuthenticated } from './useAuthenticated'
import { useAuthInterpreter } from './useAuthInterpreter'
import { useError } from './useError'

/**
 * TODO documentation when available in Nhost Cloud - see changelog
 * TODO deanonymize
 * @internal  */
export const useSignInAnonymous = () => {
  const service = useAuthInterpreter()
  const signInAnonymous = () => service.value.send('SIGNIN_ANONYMOUS')

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
