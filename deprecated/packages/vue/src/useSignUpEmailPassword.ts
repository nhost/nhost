import {
  SignUpEmailPasswordHandlerResult,
  signUpEmailPasswordPromise,
  SignUpEmailPasswordState,
  SignUpOptions
} from '@nhost/nhost-js'
import { useSelector } from '@xstate/vue'
import { ToRefs, unref } from 'vue'
import { NestedRefOfValue, nestedUnref, RefOrValue } from './helpers'
import { useAccessToken } from './useAccessToken'
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
    state.matches('registration.incomplete.failed')
  )

  const error = useError('registration')

  const isLoading = useSelector(service.value, (state) =>
    state.matches('registration.emailPassword')
  )

  const isSuccess = useSelector(service.value, (state) =>
    state.matches({
      authentication: 'signedIn',
      registration: 'complete'
    })
  )

  const needsEmailVerification = useSelector(service.value, (state) =>
    state.matches('registration.incomplete.needsEmailVerification')
  )

  const accessToken = useAccessToken()
  const refreshToken = useSelector(service.value, (state) => state.context.refreshToken.value)

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
    refreshToken,
    user
  }
}
