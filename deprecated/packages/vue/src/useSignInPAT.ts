import { SignInPATHandlerResult, SignInPATState, signInPATPromise } from '@nhost/nhost-js'
import { useSelector } from '@xstate/vue'
import { ToRefs, unref } from 'vue'
import { RefOrValue } from './helpers'
import { useAuthInterpreter } from './useAuthInterpreter'

interface SignInPATResult extends ToRefs<SignInPATState> {
  signInPAT(pat: RefOrValue<string>): Promise<SignInPATHandlerResult>
}

/**
 * Use the composable `useSignInPAT` to sign in a user using a personal access token.
 *
 * @example
 * ```tsx
 * const { signInPAT, isLoading, isSuccess, isError, error } = useSignInPAT()
 *
 * console.log({ isLoading, isSuccess, isError, error });
 *
 * const handleFormSubmit = async (e) => {
 *   e.preventDefault();
 *
 *   await signInPAT('8c5402d1-b05d-4825-a3ae-52d26402b89b')
 * }
 * ```
 *
 * @docs https://docs.nhost.io/reference/vue/use-sign-in-pat
 */
export const useSignInPAT = (): SignInPATResult => {
  const service = useAuthInterpreter()
  const signInPAT = (pat: RefOrValue<string>) => signInPATPromise(service.value, unref(pat))

  const user = useSelector(
    service.value,
    (state) => state.context.user,
    (a, b) => a?.id === b?.id
  )

  const accessToken = useSelector(service.value, (state) => state.context.accessToken.value)

  const refreshToken = useSelector(service.value, (state) => state.context.refreshToken.value)

  const error = useSelector(
    service.value,
    (state) => state.context.errors.authentication || null,
    (a, b) => a?.error === b?.error
  )

  const isSuccess = useSelector(service.value, (state) =>
    state.matches({ authentication: 'signedIn' })
  )

  const isLoading = useSelector(
    service.value,
    (state) => state.matches({ authentication: { authenticating: 'password' } }),
    (a, b) => a === b
  )

  const isError = useSelector(
    service.value,
    (state) => state.matches({ authentication: { signedOut: 'failed' } }),
    (a, b) => a === b
  )

  return {
    accessToken,
    refreshToken,
    error,
    isError,
    isLoading,
    isSuccess,
    signInPAT,
    user
  }
}
