import { ToRefs, unref } from 'vue'

import { changePasswordPromise, createChangePasswordMachine, DefaultActionState } from '@nhost/core'
import { useInterpret, useSelector } from '@xstate/vue'

import { RefOrValue } from './helpers'
import { useNhostClient } from './useNhostClient'

type ChangePasswordHandlerResult = Omit<DefaultActionState, 'isLoading'>

interface ChangePasswordComposableResult extends ToRefs<DefaultActionState> {
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

  const service = useInterpret(createChangePasswordMachine(client.auth.client))
  const isLoading = useSelector(service, (state) => state.matches('requesting'))

  const error = useSelector(service, (state) => state.context.error)
  const isError = useSelector(service, (state) => state.matches('idle.error'))
  const isSuccess = useSelector(service, (state) => state.matches('idle.success'))

  const changePassword = (password: RefOrValue<string>) =>
    changePasswordPromise(service, unref(password))

  return { changePassword, isLoading, error, isError, isSuccess }
}
