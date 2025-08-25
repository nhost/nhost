import { SignInPATHandlerResult, SignInPATState, signInPATPromise } from '@nhost/nhost-js'
import { useSelector } from '@xstate/react'
import { useAuthInterpreter } from './useAuthInterpreter'

interface SignInPATHandler {
  (pat: string): Promise<SignInPATHandlerResult>
}

export interface SignInPATHookResult extends SignInPATState {
  signInPAT: SignInPATHandler
}

interface SignInPATHook {
  (): SignInPATHookResult
}

/**
 * Use the hook `useSignInPAT` to sign in a user using a personal access token.
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
 * @docs https://docs.nhost.io/reference/react/use-sign-in-pat
 */
export const useSignInPAT: SignInPATHook = () => {
  const service = useAuthInterpreter()
  const signInPAT: SignInPATHandler = (pat: string) => signInPATPromise(service, pat)

  const user = useSelector(
    service,
    (state) => state.context.user,
    (a, b) => a?.id === b?.id
  )

  const accessToken = useSelector(service, (state) => state.context.accessToken.value)

  const refreshToken = useSelector(service, (state) => state.context.refreshToken.value)

  const error = useSelector(
    service,
    (state) => state.context.errors.authentication || null,
    (a, b) => a?.error === b?.error
  )

  const isSuccess = useSelector(service, (state) => state.matches({ authentication: 'signedIn' }))

  const isLoading = useSelector(
    service,
    (state) => state.matches({ authentication: { authenticating: 'password' } }),
    (a, b) => a === b
  )

  const isError = useSelector(
    service,
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
