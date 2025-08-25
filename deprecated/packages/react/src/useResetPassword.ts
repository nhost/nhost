import {
  createResetPasswordMachine,
  ResetPasswordHandlerResult,
  ResetPasswordOptions,
  resetPasswordPromise,
  ResetPasswordState
} from '@nhost/nhost-js'
import { useInterpret, useSelector } from '@xstate/react'
import { useMemo } from 'react'
import { useNhostClient } from './useNhostClient'

interface ResetPasswordHandler {
  (email: string, options?: ResetPasswordOptions): Promise<ResetPasswordHandlerResult>
}

export interface ResetPasswordHookResult extends ResetPasswordState {
  /**
   * Sends an email with a temporary connection link. Returns a promise with the current context
   */
  resetPassword: ResetPasswordHandler
}

interface ResetPasswordHook {
  (options?: ResetPasswordOptions): ResetPasswordHookResult
}

/**
 * Use the hook `useResetPassword` to reset the password for a user. This will send a reset password link in an email to the user. When the user clicks on the reset-password link the user is automatically signed in and can change their password using the hook `useChangePassword`.
 *
 * @example
 * ```tsx
 * const { resetPassword, isLoading, isSent, isError, error } = useResetPassword();
 *
 * console.log({ isLoading, isSent, isError, error });
 *
 * const handleFormSubmit = async (e) => {
 *   e.preventDefault();
 *
 *   await resetPassword('joe@example.com', {
 *     redirectTo: 'http://localhost:3000/settings/change-password'
 *   })
 * }
 * ```
 *
 * @docs https://docs.nhost.io/reference/react/use-reset-password
 */
export const useResetPassword: ResetPasswordHook = (options) => {
  const nhost = useNhostClient()
  const machine = useMemo(() => createResetPasswordMachine(nhost.auth.client), [nhost])
  const service = useInterpret(machine)

  const isLoading = useSelector(service, (s) => s.matches('requesting'))
  const error = useSelector(service, (state) => state.context.error)
  const isError = useSelector(service, (state) => state.matches('idle.error'))
  const isSent = useSelector(service, (state) => state.matches('idle.success'))

  const resetPassword: ResetPasswordHandler = (valueEmail, valueOptions = options) =>
    resetPasswordPromise(service, valueEmail, valueOptions)

  return { resetPassword, isLoading, isSent, isError, error }
}
