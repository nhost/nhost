import { signInAnonymousPromise } from '@nhost/nhost-js'
import { useSelector } from '@xstate/vue'
import { useAuthenticated } from './useAuthenticated'
import { useAuthInterpreter } from './useAuthInterpreter'
import { useError } from './useError'

/**
 * Use the composable `useSignInAnonymous` to sign in a user anonymously.
 *
 * As a result, the user will have the `anonymous` role and subsequent set of permissions.
 * The user can then be converted to a regular user at a later stage using email+password sign-up, passwordless email (magic link), or passwordless SMS.
 *
 * @example
 * ```tsx
 * const { signInAnonymous, isLoading, isSuccess, isError, error } = useSignInAnonymous()
 *
 * watchEffect(() => {
 *   console.log(isLoading.value, isSuccess.value, isError.value, error.value);
 * })
 *
 * const handleFormSubmit = async (e) => {
 *   e.preventDefault();
 *
 *   await signInAnonymous();
 * }
 * ```
 *
 * @docs https://docs.nhost.io/reference/vue/use-sign-in-anonymous
 */
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
