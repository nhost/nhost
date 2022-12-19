import { signInAnonymousPromise } from '@nhost/nhost-js'
import { useSelector } from '@xstate/react'
import { useAuthInterpreter } from './useAuthInterpreter'

/**
 * Use the hook `useSignInAnonymous` to sign in a user anonymously.
 *
 * As a result, the user will have the `anonymous` role and subsequent set of permissions.
 * The user can then be converted to a regular user at a later stage using email+password sign-up, passwordless email (magic link), or passwordless SMS.
 *
 * @example
 * ```tsx
 * const { signInAnonymous, isLoading, isSuccess, isError, error } = useSignInAnonymous()
 *
 * console.log({ isLoading, isSuccess, isError, error });
 *
 * const handleFormSubmit = async (e) => {
 *   e.preventDefault();
 *
 *   await signInAnonymous();
 * }
 * ```
 *
 * @docs https://docs.nhost.io/reference/react/use-sign-in-anonymous
 */
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
