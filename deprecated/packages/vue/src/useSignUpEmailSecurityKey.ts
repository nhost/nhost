import {
  signUpEmailSecurityKeyPromise,
  SignUpSecurityKeyOptions,
  SignUpSecurityKeyState
} from '@nhost/nhost-js'
import { useSelector } from '@xstate/vue'
import { ToRefs, unref } from 'vue'
import { RefOrValue } from './helpers'
import { useAuthInterpreter } from './useAuthInterpreter'

type SignUpSecurityKeyHandlerResult = Omit<SignUpSecurityKeyState, 'isLoading'>

interface SignUpSecurityKeyHandler {
  (
    email: RefOrValue<string>,
    options?: RefOrValue<SignUpSecurityKeyOptions>
  ): Promise<SignUpSecurityKeyHandlerResult>
}

export interface SignUpSecurityKeyHookResult extends ToRefs<SignUpSecurityKeyState> {
  /** Used for a new user to sign up with a security key. Returns a promise with the current context */
  signUpEmailSecurityKey: SignUpSecurityKeyHandler
}

interface SignUpSecurityKeyResult {
  (options?: SignUpSecurityKeyOptions): SignUpSecurityKeyHookResult
}

/**
 * Use the composable `useSignUpEmailSecurityKey` to sign up a user with security key and an email using the WebAuthn API.
 *
 * @example
 * ```ts
 * const { signUpEmailSecurityKey, needsEmailVerification, isLoading, isSuccess, isError, error } = useSignUpEmailSecurityKey()
 *
 * console.log({ needsEmailVerification, isLoading, isSuccess, isError, error });
 *
 * const handleFormSubmit = async (e) => {
 *   e.preventDefault();
 *
 *   await signUpEmailSecurityKey('joe@example.com')
 * }
 * ```
 *
 * @docs https://docs.nhost.io/reference/vue/use-sign-up-security-key
 */
export const useSignUpEmailSecurityKey: SignUpSecurityKeyResult = (
  hookOptions?: SignUpSecurityKeyOptions
) => {
  const service = useAuthInterpreter()
  const isError = useSelector(service.value, (state) => !!state.context.errors.registration)

  const error = useSelector(
    service.value,
    (state) => state.context.errors.registration || null,
    (a, b) => a?.error === b?.error
  )

  const isLoading = useSelector(service.value, (state) => state.matches('registration.securityKey'))

  const needsEmailVerification = useSelector(service.value, (state) =>
    state.matches('registration.incomplete.needsEmailVerification')
  )

  const isSuccess = useSelector(service.value, (state) =>
    state.matches({
      authentication: 'signedIn',
      registration: 'complete'
    })
  )

  const signUpEmailSecurityKey: SignUpSecurityKeyHandler = (email, options = hookOptions) =>
    signUpEmailSecurityKeyPromise(service.value, unref(email), unref(options))

  const user = useSelector(
    service.value,
    (state) => state.context.user,
    (a, b) => a?.id === b?.id
  )
  const accessToken = useSelector(service.value, (state) => state.context.accessToken.value)

  const refreshToken = useSelector(service.value, (state) => state.context.refreshToken.value)

  return {
    accessToken,
    refreshToken,
    error,
    isError,
    isLoading,
    isSuccess,
    needsEmailVerification,
    signUpEmailSecurityKey,
    user
  }
}
