import {
  PasswordlessOptions,
  SignInEmailPasswordlessHandlerResult,
  signInEmailPasswordlessPromise,
  SignInEmailPasswordlessState
} from '@nhost/nhost-js'
import { useSelector } from '@xstate/vue'
import { ToRefs, unref } from 'vue'
import { NestedRefOfValue, nestedUnref, RefOrValue } from './helpers'
import { useAuthInterpreter } from './useAuthInterpreter'
import { useError } from './useError'

interface SignInEmailPasswordlessResult extends ToRefs<SignInEmailPasswordlessState> {
  /** Sends a magic link to the given email */
  signInEmailPasswordless(email: RefOrValue<string>): Promise<SignInEmailPasswordlessHandlerResult>
}

/**
 * Use the composable `useSignInEmailPasswordless` to sign in a user using passwordless email (Magic Link).
 *
 * @example
 * ```tsx
 * const { signInEmailPasswordless, isLoading, isSuccess, isError, error } = useSignInEmailPasswordless()
 *
 * watchEffect(() => {
 *   console.log(isLoading.value, isSuccess.value, isError.value, error.value);
 * })
 *
 * const handleFormSubmit = async (e) => {
 *   e.preventDefault();
 *
 *   await signInEmailPasswordless('joe@example.com');
 * }
 * ```
 *
 * @docs https://docs.nhost.io/reference/vue/use-sign-in-email-passwordless
 */
export const useSignInEmailPasswordless = (
  options?: NestedRefOfValue<PasswordlessOptions | undefined>
): SignInEmailPasswordlessResult => {
  const service = useAuthInterpreter()
  const signInEmailPasswordless = (email: RefOrValue<string>) =>
    signInEmailPasswordlessPromise(service.value, unref(email), nestedUnref(options))

  const error = useError('registration')

  const isLoading = useSelector(service.value, (state) =>
    state.matches('registration.passwordlessEmail')
  )

  const isSuccess = useSelector(service.value, (state) =>
    state.matches('registration.incomplete.needsEmailVerification')
  )

  const isError = useSelector(service.value, (state) =>
    state.matches('registration.incomplete.failed')
  )

  return { signInEmailPasswordless, isLoading, isSuccess, isError, error }
}
