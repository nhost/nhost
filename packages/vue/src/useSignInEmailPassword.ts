import {
  SignInEmailPasswordHandlerResult,
  signInEmailPasswordPromise,
  SignInEmailPasswordState,
  SignInMfaTotpHandlerResult,
  signInMfaTotpPromise
} from '@nhost/nhost-js'
import { useSelector } from '@xstate/vue'
import { ToRefs, unref } from 'vue'
import { RefOrValue } from './helpers'
import { useAuthenticated } from './useAuthenticated'
import { useAuthInterpreter } from './useAuthInterpreter'
import { useError } from './useError'

interface SignInEmailPasswordResult extends ToRefs<SignInEmailPasswordState> {
  signInEmailPassword(
    email: RefOrValue<string>,
    password: RefOrValue<string>
  ): Promise<SignInEmailPasswordHandlerResult>
  sendMfaOtp(otp: RefOrValue<string>): Promise<SignInMfaTotpHandlerResult>
}

// TODO: Add MFA example once MFA is available at Nhost Cloud.
/**
 * Use the composable `useSignInEmailPassword` to sign in a user using email and password.
 *
 * @example
 * ```tsx
 * const { signInEmailPassword, needsEmailVerification, isLoading, isSuccess, isError, error } = useSignInEmailPassword()
 *
 * watchEffect(() => {
 *   console.log(needsEmailVerification.value, isLoading.value, isSuccess.value, isError.value, error.value);
 * })
 *
 * const handleFormSubmit = async (e) => {
 *   e.preventDefault();
 *
 *   await signInEmailPassword('joe@example.com','secret-password')
 * }
 * ```
 *
 * @docs https://docs.nhost.io/reference/vue/use-sign-in-email-password
 */
export const useSignInEmailPassword = (): SignInEmailPasswordResult => {
  const service = useAuthInterpreter()
  const signInEmailPassword = (email: RefOrValue<string>, password: RefOrValue<string>) =>
    signInEmailPasswordPromise(service.value, unref(email), unref(password))

  const sendMfaOtp = (otp: RefOrValue<string>) => signInMfaTotpPromise(service.value, unref(otp))

  const user = useSelector(
    service.value,
    (state) => state.context.user,
    (a, b) => a?.id === b?.id
  )

  const accessToken = useSelector(service.value, (state) => state.context.accessToken.value)

  const refreshToken = useSelector(service.value, (state) => state.context.refreshToken.value)

  const error = useError('authentication')

  const isSuccess = useAuthenticated()

  const isLoading = useSelector(
    service.value,
    (state) => state.matches({ authentication: { authenticating: 'password' } }),
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

  const mfa = useSelector(service.value, (state) => state.context.mfa)
  const needsMfaOtp = useSelector(
    service.value,
    (state) => state.matches({ authentication: { signedOut: 'needsMfa' } }),
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
    needsMfaOtp,
    mfa,
    sendMfaOtp,
    signInEmailPassword,
    user
  }
}
