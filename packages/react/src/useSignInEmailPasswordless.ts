import {
  ActionErrorState,
  ActionLoadingState,
  ActionSuccessState,
  PasswordlessOptions,
  SignInEmailPasswordlessHandlerResult,
  signInEmailPasswordlessPromise
} from '@nhost/nhost-js'
import { useSelector } from '@xstate/react'
import { useAuthInterpreter } from './useAuthInterpreter'

interface SignInEmailPasswordlessHandler {
  (email: string, options?: PasswordlessOptions): Promise<SignInEmailPasswordlessHandlerResult>
}

export interface SignInEmailPasswordlessHookResult
  extends ActionLoadingState,
    ActionSuccessState,
    ActionErrorState {
  /** Sends a magic link to the given email */
  signInEmailPasswordless: SignInEmailPasswordlessHandler
}

/**
 * Use the hook `useSignInEmailPasswordless` to sign in a user using passwordless email (Magic Link).
 *
 * @example
 * ```tsx
 * const { signInEmailPasswordless, isLoading, isSuccess, isError, error } = useSignInEmailPasswordless()
 *
 * console.log({ isLoading, isSuccess, isError, error });
 *
 * const handleFormSubmit = async (e) => {
 *   e.preventDefault();
 *
 *   await signInEmailPasswordless('joe@example.com');
 * }
 * ```
 *
 * @docs https://docs.nhost.io/reference/react/use-sign-in-email-passwordless
 */
export function useSignInEmailPasswordless(
  options?: PasswordlessOptions
): SignInEmailPasswordlessHookResult {
  const service = useAuthInterpreter()

  const signInEmailPasswordless: SignInEmailPasswordlessHandler = (
    valueEmail,
    valueOptions = options
  ) => signInEmailPasswordlessPromise(service, valueEmail, valueOptions)

  const error = useSelector(
    service,
    (state) => state.context.errors.registration || null,
    (a, b) => a?.error === b?.error
  )
  const isLoading = useSelector(service, (state) => state.matches('registration.passwordlessEmail'))

  const isSuccess = useSelector(service, (state) =>
    state.matches('registration.incomplete.needsEmailVerification')
  )

  const isError = useSelector(service, (state) => state.matches('registration.incomplete.failed'))

  return { signInEmailPasswordless, isLoading, isSuccess, isError, error }
}
