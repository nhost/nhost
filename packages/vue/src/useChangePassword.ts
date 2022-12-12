import {
  ChangePasswordHandlerResult,
  changePasswordPromise,
  ChangePasswordState,
  createChangePasswordMachine
} from '@nhost/nhost-js'
import { useInterpret, useSelector } from '@xstate/vue'
import { ToRefs, unref } from 'vue'
import { RefOrValue } from './helpers'
import { useNhostClient } from './useNhostClient'

export interface ChangePasswordComposableResult extends ToRefs<ChangePasswordState> {
  changePassword(password: RefOrValue<string>): Promise<ChangePasswordHandlerResult>
}

/**
 * Use the composable `useChangePassword` to change password for the user.
 *
 * @example
 * ```tsx
 * const { changePassword, isLoading, isSuccess, isError, error } = useChangePassword();
 *
 * watchEffect(() => {
 *   console.log(isLoading.value, isSuccess.value, isError.value, error.value);
 * })
 *
 * const handleFormSubmit = async (e) => {
 *   e.preventDefault();
 *
 *   await changePassword('my-new-password')
 * }
 * ```
 *
 * @docs https://docs.nhost.io/reference/vue/use-change-password
 */
export const useChangePassword = (): ChangePasswordComposableResult => {
  const { nhost } = useNhostClient()

  const service = useInterpret(createChangePasswordMachine(nhost.auth.client))
  const isLoading = useSelector(service, (state) => state.matches('requesting'))

  const error = useSelector(service, (state) => state.context.error)
  const isError = useSelector(service, (state) => state.matches('idle.error'))
  const isSuccess = useSelector(service, (state) => state.matches('idle.success'))

  const changePassword = (password: RefOrValue<string>) =>
    changePasswordPromise(service, unref(password))

  return { changePassword, isLoading, error, isError, isSuccess }
}
