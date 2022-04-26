import { reactive, ToRefs, toRefs, unref } from 'vue'

import { createChangePasswordMachine } from '@nhost/core'
import { useMachine, useSelector } from '@xstate/vue'

import { RefOrValue } from './helpers'
import { DefaultActionComposableState } from './types'
import { useNhostClient } from './useNhostClient'

type ChangePasswordHandlerResult = Omit<DefaultActionComposableState, 'isLoading'>

interface ChangePasswordComposableResult extends ToRefs<DefaultActionComposableState> {
  changePassword(password: RefOrValue<string>): Promise<ChangePasswordHandlerResult>
}

/**
 * Change password
 * 
 * @example
```js
const { changePassword, isLoading, isSuccess, isError, error } =
  useChangePassword();
```
 * 
 */
export const useChangePassword = (): ChangePasswordComposableResult => {
  const { client } = useNhostClient()

  const { send, service } = useMachine(createChangePasswordMachine(client.auth.client))
  const isLoading = useSelector(service, (state) => state.matches('requesting'))

  const result = reactive<ChangePasswordHandlerResult>({
    error: null,
    isError: false,
    isSuccess: false
  })

  const changePassword = (password: RefOrValue<string>) =>
    new Promise<ChangePasswordHandlerResult>((resolve) => {
      send({
        type: 'REQUEST',
        password: unref(password)
      })
      service.onTransition((state) => {
        if (state.matches({ idle: 'error' })) {
          result.error = state.context.error
          result.isError = true
          result.isSuccess = false
          resolve(result)
        } else if (state.matches({ idle: 'success' })) {
          result.error = null
          result.isError = false
          result.isSuccess = true
          resolve(result)
        }
      })
    })

  return { changePassword, isLoading, ...toRefs(result) }
}
