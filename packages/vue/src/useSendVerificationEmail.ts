import {
  createSendVerificationEmailMachine,
  SendVerificationEmailHandlerResult,
  SendVerificationEmailOptions,
  sendVerificationEmailPromise,
  SendVerificationEmailState
} from '@nhost/nhost-js'
import { useInterpret, useSelector } from '@xstate/vue'
import { reactive, ToRefs, toRefs, unref } from 'vue'
import { NestedRefOfValue, nestedUnref, RefOrValue } from './helpers'
import { useNhostClient } from './useNhostClient'

interface SendVerificationEmailResult extends ToRefs<SendVerificationEmailState> {
  /** Resend the verification email. Returns a promise with the current context */
  sendEmail(email: RefOrValue<string>): Promise<SendVerificationEmailHandlerResult>
}

/**
 * Use the composable `useSendVerificationEmail` to send a verification email. The verification email is sent to the user's email address and includes a link to verify the email address.
 *
 * @example
 * ```tsx
 * const { sendEmail, isLoading, isSent, isError, error } =
  useSendVerificationEmail();
 *
 * watchEffect(() => {
 *   console.log(isLoading.value, isSent.value, isError.value, error.value);
 * })
 * 
 * const handleFormSubmit = async (e) => {
 *   e.preventDefault();
 *
 *   await sendEmail({
 *     email: 'joe@example.com',
 *   })
 * }
 * ```
 *
 * @docs https://docs.nhost.io/reference/vue/use-send-verification-email
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
