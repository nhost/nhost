import { computed, ToRefs, unref } from 'vue'

import {
  SignUpEmailPasswordHandlerResult,
  signUpEmailPasswordPromise,
  SignUpEmailPasswordState,
  SignUpOptions
} from '@nhost/core'
import { useSelector } from '@xstate/vue'

import { NestedRefOfValue, nestedUnref, RefOrValue } from './helpers'
import { useAccessToken } from './useAccessToken'
import { useAuthenticationStatus } from './useAuthenticationStatus'
import { useAuthInterpreter } from './useAuthInterpreter'
import { useError } from './useError'
import { useUserData } from './useUserData'
interface SignUpEmailPasswordResult extends ToRefs<SignUpEmailPasswordState> {
  /** Used for a new user to sign up. Returns a promise with the current context */
  signUpEmailPassword(
    email: RefOrValue<string>,
    password: RefOrValue<string>,
    options?: NestedRefOfValue<SignUpOptions | undefined>
  ): Promise<SignUpEmailPasswordHandlerResult>
}

/**
 * Use the composable `useSignUpEmailPassword` to sign up a user using email and password.
 *
 * @example
 * ```tsx
 * const { signUpEmailPassword, needsEmailVerification, isLoading, isSuccess, isError, error } = useSignUpEmailPassword()
 *
 * watchEffect(() => {
 *   console.log(needsEmailVerification.value, isLoading.value, isSuccess.value, isError.value, error.value);
 * })
 *
 * const handleFormSubmit = async (e) => {
 *   e.preventDefault();
 *
 *   await signUpEmailPassword('joe@example.com','secret-password')
 * }
 * ```
 *
 * @docs https://docs.nhost.io/reference/vue/use-sign-up-email-password
 */
export const useSignUpEmailPassword = (
  options?: NestedRefOfValue<SignUpOptions | undefined>
): SignUpEmailPasswordResult => {
  const service = useAuthInterpreter()
  const isError = useSelector(service.value, (state) =>
    state.matches({ authentication: { signedOut: 'failed' } })
  )

  const error = useError('signUp')

  const { isLoading: loading, isAuthenticated: isSuccess } = useAuthenticationStatus()

  const isLoading = computed(() => loading.value && !isSuccess.value)
  const needsEmailVerification = useSelector(service.value, (state) =>
    state.matches({ authentication: { signedOut: 'noErrors' }, email: 'awaitingVerification' })
  )
  const accessToken = useAccessToken()
  const user = useUserData()
  const signUpEmailPassword = (
    email: RefOrValue<string>,
    password: RefOrValue<string>,
    handlerOptions: NestedRefOfValue<SignUpOptions | undefined>
  ) =>
    signUpEmailPasswordPromise(service.value, unref(email), unref(password), {
      ...nestedUnref(options),
      ...nestedUnref(handlerOptions)
    })

  return {
    signUpEmailPassword,
    isLoading,
    isSuccess,
    isError,
    error,
    needsEmailVerification,
    accessToken,
    user
  }
}
