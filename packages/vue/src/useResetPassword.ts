import { ToRefs, unref } from 'vue'

import {
  CommonActionState,
  createResetPasswordMachine,
  ResetPasswordOptions,
  resetPasswordPromise
} from '@nhost/core'
import { useMachine, useSelector } from '@xstate/vue'

import { RefOrValue } from './helpers'
import { useNhostClient } from './useNhostClient'

interface ResetPasswordState extends CommonActionState {
  isSent: boolean
}
type ResetPasswordHandlerResult = Omit<ResetPasswordState, 'isLoading'>
interface ResetPasswordHandler {
  (email: string, options?: ResetPasswordOptions): Promise<ResetPasswordHandlerResult>
}

interface ResetPasswordResult extends ToRefs<ResetPasswordState> {
  /**
   * Sends an email with a temporary connection link. Returns a promise with the current context
   */
  resetPassword: ResetPasswordHandler
}

/**
 * If a user loses their password, we can resend them an email to authenticate so that they can change it to a new one
 * @example
```js
const { resetPassword, isLoading, isSent, isError, error } =
  useResetPassword();
```
 * 
 */
export const useResetPassword = (
  options?: RefOrValue<ResetPasswordOptions | undefined>
): ResetPasswordResult => {
  const { client } = useNhostClient()
  const { service } = useMachine(createResetPasswordMachine(client.auth.client))

  const isLoading = useSelector(service, (state) => state.matches('requesting'))
  const isSent = useSelector(service, (state) => state.matches({ idle: 'success' }))
  const isError = useSelector(service, (state) => state.matches({ idle: 'error' }))
  const error = useSelector(service, (state) => state.context.error)

  const resetPassword = (email: RefOrValue<string>) =>
    resetPasswordPromise(service, unref(email), unref(options))

  return { resetPassword, isLoading, isError, isSent, error }
}
