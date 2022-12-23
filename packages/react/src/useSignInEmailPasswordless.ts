import {
  PasswordlessOptions,
  SignInEmailPasswordlessHandlerResult,
  signInEmailPasswordlessPromise,
  SignInEmailPasswordState
} from '@nhost/nhost-js'
import { useSelector } from '@xstate/react'
import { useAuthInterpreter } from './useAuthInterpreter'

interface SignInEmailPasswordlessHandler {
  (email: string, options?: PasswordlessOptions): Promise<SignInEmailPasswordlessHandlerResult>
  /** @deprecated */
  (email?: unknown, options?: PasswordlessOptions): Promise<SignInEmailPasswordlessHandlerResult>
}

export interface SignInEmailPasswordlessHookResult extends SignInEmailPasswordState {
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
): SignInEmailPasswordlessHookResult

/**
 * @deprecated
 */
export function useSignInEmailPasswordless(
  email?: string,
  options?: PasswordlessOptions
): SignInEmailPasswordlessHookResult

export function useSignInEmailPasswordless(
  a?: string | PasswordlessOptions,
  b?: PasswordlessOptions
) {
  const stateEmail = typeof a === 'string' ? a : undefined
  const stateOptions = typeof a === 'string' ? b : a
  const service = useAuthInterpreter()

  const signInEmailPasswordless: SignInEmailPasswordlessHandler = (
    valueEmail?: string | unknown,
    valueOptions = stateOptions
  ) =>
    signInEmailPasswordlessPromise(
      service,
      (typeof valueEmail === 'string' ? valueEmail : stateEmail) as string,
      valueOptions
    )

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
