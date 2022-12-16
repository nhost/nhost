import {
  ActionErrorState,
  ActionSuccessState,
  ChangePasswordHandlerResult,
  changePasswordPromise,
  createChangePasswordMachine
} from '@nhost/nhost-js'
import { useInterpret, useSelector } from '@xstate/react'
import { useMemo } from 'react'
import { useNhostClient } from './useNhostClient'

interface ChangePasswordHandler {
  (password: string): Promise<ChangePasswordHandlerResult>
  /** @deprecated */
  (password?: unknown): Promise<ChangePasswordHandlerResult>
}

export interface ChangePasswordHookResult extends ActionErrorState, ActionSuccessState {
  /** Requests the password change. Returns a promise with the current context */
  changePassword: ChangePasswordHandler
}

interface ChangePasswordHook {
  (): ChangePasswordHookResult
  /** @deprecated */
  (email?: string): ChangePasswordHookResult
}

/**
 * Use the hook `useChangePassword` to change password for the user.
 *
 * @example
 * ```tsx
 * const { changePassword, isLoading, isSuccess, isError, error } = useChangePassword();
 *
 * console.log({ isLoading, isSuccess, isError, error });
 *
 * const handleFormSubmit = async (e) => {
 *   e.preventDefault();
 *
 *   await changePassword('my-new-password')
 * }
 * ```
 *
 * @docs https://docs.nhost.io/reference/react/use-change-password
 */
export const useChangePassword: ChangePasswordHook = (statePassword?: string) => {
  const nhost = useNhostClient()
  const machine = useMemo(() => createChangePasswordMachine(nhost.auth.client), [nhost])
  const service = useInterpret(machine)

  const isError = useSelector(service, (state) => state.matches({ idle: 'error' }))
  const isSuccess = useSelector(service, (state) => state.matches({ idle: 'success' }))
  const error = useSelector(service, (state) => state.context.error)
  const isLoading = useSelector(service, (state) => state.matches('requesting'))

  const changePassword: ChangePasswordHandler = (valuePassword?: string | unknown) =>
    changePasswordPromise(
      service,
      typeof valuePassword === 'string' ? valuePassword : (statePassword as string)
    )

  return { changePassword, isLoading, isSuccess, isError, error }
}
