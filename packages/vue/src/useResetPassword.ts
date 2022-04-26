import { reactive, ToRefs, toRefs, unref } from 'vue'

import { createResetPasswordMachine, ResetPasswordOptions } from '@nhost/core'
import { useMachine, useSelector } from '@xstate/vue'

import { RefOrValue } from './helpers'
import { CommonActionComposableState } from './types'
import { useNhostClient } from './useNhostClient'

type ResetPasswordHandlerResult = Omit<ResetPasswordComposableState, 'isLoading'>
interface ResetPasswordHandler {
  (email: string, options?: ResetPasswordOptions): Promise<ResetPasswordHandlerResult>
}

interface ResetPasswordComposableState extends CommonActionComposableState {
  isSent: boolean
}

interface ResetPasswordComposableResult extends ToRefs<ResetPasswordComposableState> {
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
): ResetPasswordComposableResult => {
  const { client } = useNhostClient()
  const { send, service } = useMachine(createResetPasswordMachine(client.auth.client))

  const result = reactive<ResetPasswordHandlerResult>({
    error: null,
    isError: false,
    isSent: false
  })

  const isLoading = useSelector(service, (state) => state.matches('requesting'))

  const resetPassword = (email: RefOrValue<string>) =>
    new Promise<ResetPasswordHandlerResult>((resolve) => {
      send({
        type: 'REQUEST',
        email: unref(email),
        options: unref(options)
      })
      service.onTransition((state) => {
        if (state.matches({ idle: 'error' })) {
          result.error = state.context.error
          result.isError = true
          result.isSent = false
          resolve(result)
        } else if (state.matches({ idle: 'success' })) {
          result.error = null
          result.isError = false
          result.isSent = true
          resolve(result)
        }
      })
    })

  return { resetPassword, isLoading, ...toRefs(result) }
}
