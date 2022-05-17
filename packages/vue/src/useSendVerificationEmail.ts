import { reactive, ToRefs, toRefs, unref } from 'vue'

import {
  createSendVerificationEmailMachine,
  SendVerificationEmailHandlerResult,
  SendVerificationEmailOptions,
  sendVerificationEmailPromise,
  SendVerificationEmailState
} from '@nhost/core'
import { useInterpret, useSelector } from '@xstate/vue'

import { NestedRefOfValue, nestedUnref, RefOrValue } from './helpers'
import { useNhostClient } from './useNhostClient'

interface SendVerificationEmailResult extends ToRefs<SendVerificationEmailState> {
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
  options?: NestedRefOfValue<SendVerificationEmailOptions | undefined>
): SendVerificationEmailResult => {
  const { nhost } = useNhostClient()
  const service = useInterpret(createSendVerificationEmailMachine(nhost.auth.client))
  const isLoading = useSelector(service, (state) => state.matches('requesting'))

  const result = reactive<SendVerificationEmailHandlerResult>({
    isError: false,
    error: null,
    isSent: false
  })

  const sendEmail = (email: RefOrValue<string>) =>
    sendVerificationEmailPromise(service, unref(email), nestedUnref(options))

  return { sendEmail, isLoading, ...toRefs(result) }
}
