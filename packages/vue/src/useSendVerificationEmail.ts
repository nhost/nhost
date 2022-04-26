import { reactive, ToRefs, toRefs, unref } from 'vue'

import { createSendVerificationEmailMachine, SendVerificationEmailOptions } from '@nhost/core'
import { useMachine, useSelector } from '@xstate/vue'

import { RefOrValue } from './helpers'
import { CommonActionComposableState } from './types'
import { useNhostClient } from './useNhostClient'

type SendVerificationEmailHandlerResult = Omit<SendVerificationEmailComposableState, 'isLoading'>
interface SendVerificationEmailComposableState extends CommonActionComposableState {
  isSent: boolean
}

interface SendVerificationEmailComposableResult
  extends ToRefs<SendVerificationEmailComposableState> {
  /** Resend the verification email. Returns a promise with the current context */
  sendEmail(email: RefOrValue<string>): Promise<SendVerificationEmailHandlerResult>
}

/**
 * Send an email verification
 * @example
```js
const { sendEmail, isLoading, isSent, isError, error } =
  useSendVerificationEmail();
```
 * 
 */
export const useSendVerificationEmail = (
  options?: RefOrValue<SendVerificationEmailOptions | undefined>
): SendVerificationEmailComposableResult => {
  const { client } = useNhostClient()
  const { send, service } = useMachine(createSendVerificationEmailMachine(client.auth.client))
  const isLoading = useSelector(service, (state) => state.matches('requesting'))

  const result = reactive<SendVerificationEmailHandlerResult>({
    isError: false,
    error: null,
    isSent: false
  })

  const sendEmail = (email: RefOrValue<string>) =>
    new Promise<SendVerificationEmailHandlerResult>((resolve) => {
      send({
        type: 'REQUEST',
        email: unref(email),
        options: unref(options)
      })
      service.onTransition((state) => {
        if (state.matches({ idle: 'error' })) {
          result.isError = true
          result.error = state.context.error
          result.isSent = false
          resolve(result)
        } else if (state.matches({ idle: 'success' })) {
          result.isError = false
          result.error = null
          result.isSent = true
          resolve(result)
        }
      })
    })
  return { sendEmail, isLoading, ...toRefs(result) }
}
