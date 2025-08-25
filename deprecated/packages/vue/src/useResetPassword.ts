import {
  createResetPasswordMachine,
  ResetPasswordHandlerResult,
  ResetPasswordOptions,
  resetPasswordPromise,
  ResetPasswordState
} from '@nhost/nhost-js'
import { useInterpret, useSelector } from '@xstate/vue'
import { ToRefs, unref } from 'vue'
import { NestedRefOfValue, nestedUnref, RefOrValue } from './helpers'
import { useNhostClient } from './useNhostClient'

interface ResetPasswordResult extends ToRefs<ResetPasswordState> {
  resetPassword: (email: RefOrValue<string>) => Promise<ResetPasswordHandlerResult>
}

/**
 * Use the composable `useResetPassword` to reset the password for a user. This will send a reset password link in an email to the user. When the user clicks on the reset-password link the user is automatically signed in and can change their password using the composable `useChangePassword`.
 *
 * @example
 * ```tsx
 * const { resetPassword, isLoading, isSent, isError, error } = useResetPassword({
 *   redirectTo: 'http://localhost:3000/settings/change-password'
 * });
 *
 * watchEffect(() => {
 *   console.log(isLoading.value, isSent.value, isError.value, error.value);
 * })
 *
 * const handleFormSubmit = async (e) => {
 *   e.preventDefault();
 *
 *   await resetPassword('joe@example.com')
 * }
 * ```
 *
 * @docs https://docs.nhost.io/reference/vue/use-reset-password
 */
export const useResetPassword = (
  options?: NestedRefOfValue<ResetPasswordOptions | undefined>
): ResetPasswordResult => {
  const { nhost } = useNhostClient()
  const service = useInterpret(createResetPasswordMachine(nhost.auth.client))

  const isLoading = useSelector(service, (state) => state.matches('requesting'))
  const isSent = useSelector(service, (state) => state.matches({ idle: 'success' }))
  const isError = useSelector(service, (state) => state.matches({ idle: 'error' }))
  const error = useSelector(service, (state) => state.context.error)

  const resetPassword = (email: RefOrValue<string>) =>
    resetPasswordPromise(service, unref(email), nestedUnref(options))

  return { resetPassword, isLoading, isError, isSent, error }
}
