import { signInAnonymousPromise } from '@nhost/core'
import { useSelector } from '@xstate/react'

import { useAuthInterpreter } from './useAuthInterpreter'

// TODO documentation when available in Nhost Cloud - see changelog
// TODO deanonymize
// TODO review nhost.auth.signIn()
export const useSignInAnonymous = () => {
  const service = useAuthInterpreter()
  const signInAnonymous = () => signInAnonymousPromise(service)

  const error = useSelector(
    service,
    (state) => state.context.errors.authentication || null,
    (a, b) => a?.error === b?.error
  )
  const isLoading = useSelector(service, (state) =>
    state.matches({ authentication: { authenticating: 'anonymous' } })
  )
  const isSuccess = useSelector(service, (state) =>
    state.matches({
      authentication: 'signedIn'
    })
  )
  const isError = useSelector(service, (state) =>
    state.matches({ authentication: { signedOut: 'failed' } })
  )
  const user = useSelector(
    service,
    (state) => state.context.user,
    (a, b) => a?.id === b?.id
  )
  const accessToken = useSelector(service, (state) => state.context.accessToken.value)
  return { accessToken, error, isError, isLoading, isSuccess, signInAnonymous, user }
}
