import {
  ChangeEmailHandlerResult,
  ChangeEmailOptions,
  changeEmailPromise,
  ChangeEmailState,
  createChangeEmailMachine
} from '@nhost/nhost-js'
import { useInterpret, useSelector } from '@xstate/vue'
import { ToRefs, unref } from 'vue'
import { NestedRefOfValue, nestedUnref, RefOrValue } from './helpers'
import { useNhostClient } from './useNhostClient'

export interface ChangeEmailComposableResult extends ToRefs<ChangeEmailState> {
  /** Requests the email change. Returns a promise with the current context  */
  changeEmail(email: RefOrValue<string>): Promise<ChangeEmailHandlerResult>
}

/**
 * Use the composable `useChangeEmail` to change email for the user.
 *
 * @example
 * ```tsx
 * const { changeEmail, isLoading, needsEmailVerification, isError, error } = useChangeEmail();
 *
 * watchEffect(() => {
 *   console.log(isLoading.value, needsEmailVerification.value, isError.value, error.value);
 * })
 *
 * const handleFormSubmit = async (e) => {
 *   e.preventDefault();
 *
 *   await changeEmail('new@example.com')
 * }
 * ```
 *
 * @docs https://docs.nhost.io/reference/vue/use-change-email
 */
export const useChangeEmail = (
  options?: NestedRefOfValue<ChangeEmailOptions | undefined>
): ChangeEmailComposableResult => {
  const { nhost } = useNhostClient()

  const service = useInterpret(createChangeEmailMachine(nhost.auth.client))
  const isLoading = useSelector(service, (state) => state.matches('requesting'))

  const error = useSelector(service, (state) => state.context.error)
  const isError = useSelector(service, (state) => state.matches('idle.error'))
  const needsEmailVerification = useSelector(service, (state) => state.matches('idle.success'))

  const changeEmail = (email: string) =>
    changeEmailPromise(service, unref(email), nestedUnref(options))

  return { changeEmail, isLoading, error, isError, needsEmailVerification }
}
