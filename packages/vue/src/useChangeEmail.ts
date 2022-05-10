import { ToRefs, unref } from 'vue'

import {
  ChangeEmailOptions,
  changeEmailPromise,
  CommonActionState,
  createChangeEmailMachine
} from '@nhost/core'
import { useMachine, useSelector } from '@xstate/vue'

import { RefOrValue } from './helpers'
import { useNhostClient } from './useNhostClient'

interface ChangeEmailState extends CommonActionState {
  needsEmailVerification: boolean
}
type ChangeEmailHandlerResult = Omit<ChangeEmailState, 'isLoading'>

interface ChangeEmailComposableResult extends ToRefs<ChangeEmailState> {
  /** Requests the email change. Returns a promise with the current context  */
  changeEmail(email: RefOrValue<string>): Promise<ChangeEmailHandlerResult>
}

/**
 * Change email
 * 
 * @example
```js
const { changeEmail, isLoading, needsEmailVerification, isError, error } =
  useChangeEmail();
  ```
*/
export const useChangeEmail = (
  options?: RefOrValue<ChangeEmailOptions | undefined>
): ChangeEmailComposableResult => {
  const { client } = useNhostClient()
  const { service } = useMachine(createChangeEmailMachine(client.auth.client))
  const isLoading = useSelector(service, (s) => s.matches('requesting'))

  const error = useSelector(service, (state) => state.context.error)
  const isError = useSelector(service, (state) => state.matches('idle.error'))
  const needsEmailVerification = useSelector(service, (state) => state.matches('idle.success'))

  const changeEmail = (email: string) => changeEmailPromise(service, unref(email), unref(options))

  return { changeEmail, isLoading, error, isError, needsEmailVerification }
}
