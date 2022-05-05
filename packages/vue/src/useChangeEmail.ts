import { reactive, ToRefs, toRefs, unref } from 'vue'

import { ChangeEmailOptions, createChangeEmailMachine } from '@nhost/core'
import { useMachine, useSelector } from '@xstate/vue'

import { RefOrValue } from './helpers'
import { CommonActionComposableState } from './types'
import { useNhostClient } from './useNhostClient'

interface ChangeEmailComposableState extends CommonActionComposableState {
  needsEmailVerification: boolean
}
type ChangeEmailHandlerResult = Omit<ChangeEmailComposableState, 'isLoading'>

interface ChangeEmailComposableResult extends ToRefs<ChangeEmailComposableState> {
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
  const { send, service } = useMachine(createChangeEmailMachine(client.auth.client))
  const isLoading = useSelector(service, (s) => s.matches('requesting'))

  const reactiveState = reactive<ChangeEmailHandlerResult>({
    error: null,
    isError: false,
    needsEmailVerification: false
  })

  const changeEmail = (email) =>
    new Promise<ChangeEmailHandlerResult>((resolve) => {
      send('REQUEST', {
        email: unref(email),
        options: unref(options)
      })
      service.onTransition((s) => {
        if (s.matches({ idle: 'error' })) {
          reactiveState.isError = true
          reactiveState.error = s.context.error
          resolve(reactiveState)
        } else if (s.matches({ idle: 'success' })) {
          reactiveState.error = null
          reactiveState.isError = false
          reactiveState.needsEmailVerification = true
          resolve(reactiveState)
        }
      })
    })

  return { changeEmail, isLoading, ...toRefs(reactiveState) }
}
