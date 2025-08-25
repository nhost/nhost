import {
  SignInSecurityKeyHandlerResult,
  signInSecurityKeyPromise,
  SignInSecurityKeyState
} from '@nhost/nhost-js'
import { useSelector } from '@xstate/vue'
import { ToRefs } from 'vue'
import { useAuthInterpreter } from './useAuthInterpreter'

interface SignInSecurityKeyHandler {
  (): Promise<SignInSecurityKeyHandlerResult>
}

export interface SignInSecurityKeyHookResult extends ToRefs<SignInSecurityKeyState> {
  signInSecurityKey: SignInSecurityKeyHandler
}

interface SignInSecurityKeyResult {
  (): SignInSecurityKeyHookResult
}

/**
 * Use the composable `useSignInSecurityKey` to sign in a user with a security key using the WebAuthn API
 *
 * @example
 * ```tsx
 * const { signInSecurityKey, needsEmailVerification, isLoading, isSuccess, isError, error } = useSignInSecurityKey()
 *
 * console.log({ needsEmailVerification, isLoading, isSuccess, isError, error });
 *
 * const handleFormSubmit = async (e) => {
 *   e.preventDefault();
 *
 *   await signInSecurityKey()
 * }
 * ```
 *
 * @docs https://docs.nhost.io/reference/vue/use-sign-in-security-key
 */
export const useSignInSecurityKey: SignInSecurityKeyResult = () => {
  const service = useAuthInterpreter()
  const signInSecurityKey: SignInSecurityKeyHandler = () => signInSecurityKeyPromise(service.value)

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
    signInSecurityKey,
    user
  }
}
