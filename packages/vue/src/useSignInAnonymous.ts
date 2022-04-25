import { useSelector } from '@xstate/vue'

import { useAuthenticated } from './useAuthenticated'
import { useAuthInterpreter } from './useAuthInterpreter'

// TODO documentation when available in Nhost Cloud - see changelog
// TODO deanonymize
export const useSignInAnonymous = () => {
  const service = useAuthInterpreter()
  const signInAnonymous = () => service.value.send('SIGNIN_ANONYMOUS')

  const error = useSelector(
    service.value,
    (state) => state.context.errors.authentication,
    (a, b) => a?.error === b?.error
  )
  const isLoading =
    !!service.value.status &&
    service.value.state.matches({ authentication: { authenticating: 'anonymous' } })
  const isSuccess = useAuthenticated()
  const isError =
    !!service.value.status &&
    service.value.state.matches({ authentication: { signedOut: 'failed' } })
  return { signInAnonymous, isLoading, isSuccess, isError, error }
}
