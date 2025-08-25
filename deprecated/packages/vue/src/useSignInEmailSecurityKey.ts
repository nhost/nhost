import {
  signInEmailSecurityKeyPromise,
  SignInSecurityKeyPasswordlessHandlerResult,
  SignInSecurityKeyPasswordlessState
} from '@nhost/nhost-js'
import { useSelector } from '@xstate/vue'
import { ToRefs, unref } from 'vue'
import { RefOrValue } from './helpers'
import { useAuthInterpreter } from './useAuthInterpreter'

interface SignInSecurityKeyPasswordlessHandler {
  (email: RefOrValue<string>): Promise<SignInSecurityKeyPasswordlessHandlerResult>
}

export interface SignInSecurityKeyPasswordlessHookResult
  extends ToRefs<SignInSecurityKeyPasswordlessState> {
  signInEmailSecurityKey: SignInSecurityKeyPasswordlessHandler
}

interface SignInSecurityKeyPasswordlessResult {
  (): SignInSecurityKeyPasswordlessHookResult
}

/**
 * Use the composable `useSignInEmailSecurityKey` to sign in a user using their email and a security key using the WebAuthn API.
 *
 * @example
 * ```tsx
 * const { signInEmailSecurityKey, needsEmailVerification, isLoading, isSuccess, isError, error } = useSignInEmailSecurityKey()
 *
 * console.log({ needsEmailVerification, isLoading, isSuccess, isError, error });
 *
 * const handleFormSubmit = async (e) => {
 *   e.preventDefault();
 *
 *   await signInEmailSecurityKey('joe@example.com')
 * }
 * ```
 *
 * @docs https://docs.nhost.io/reference/vue/use-sign-in-web-authn
 */
export const useSignInEmailSecurityKey: SignInSecurityKeyPasswordlessResult = () => {
  const service = useAuthInterpreter()
  const signInEmailSecurityKey: SignInSecurityKeyPasswordlessHandler = (
    email: RefOrValue<string>
  ) => signInEmailSecurityKeyPromise(service.value, unref(email))

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
    state.matches({
      authentication: 'signedIn'
    })
  )
  const isLoading = useSelector(
    service.value,
    (state) => state.matches({ authentication: { authenticating: 'securityKeyEmail' } }),
    (a, b) => a === b
  )

  const needsEmailVerification = useSelector(
    service.value,
    (state) =>
      state.matches({
        authentication: { signedOut: 'noErrors' },
        registration: { incomplete: 'needsEmailVerification' }
      }),
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
    needsEmailVerification,
    signInEmailSecurityKey,
    user
  }
}
