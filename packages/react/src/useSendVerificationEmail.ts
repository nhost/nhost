import {
  createSendVerificationEmailMachine,
  SendVerificationEmailHandlerResult,
  SendVerificationEmailOptions,
  sendVerificationEmailPromise,
  SendVerificationEmailState
} from '@nhost/nhost-js'
import { useInterpret, useSelector } from '@xstate/react'
import { useMemo } from 'react'
import { useNhostClient } from './useNhostClient'

interface SendVerificationEmailHandler {
  (
    email: string,
    options?: SendVerificationEmailOptions
  ): Promise<SendVerificationEmailHandlerResult>
}

export interface SendVerificationEmailHookResult extends SendVerificationEmailState {
  /** Resend the verification email. Returns a promise with the current context */
  sendEmail: SendVerificationEmailHandler
}

interface SendVerificationEmailHook {
  (options?: SendVerificationEmailOptions): SendVerificationEmailHookResult
}

/**
 * Use the hook `useSendVerificationEmail` to send a verification email. The verification email is sent to the user's email address and includes a link to verify the email address.
 *
 * @example
 * ```tsx
 * const { sendEmail, isLoading, isSent, isError, error } =
  useSendVerificationEmail();
 *
 * console.log({ isLoading, isSent, isError, error });
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
 * @docs https://docs.nhost.io/reference/react/use-send-verification-email
 */
export const useSendVerificationEmail: SendVerificationEmailHook = (options) => {
  const nhost = useNhostClient()
  const machine = useMemo(() => createSendVerificationEmailMachine(nhost.auth.client), [nhost])
  const service = useInterpret(machine)
  const isError = useSelector(service, (state) => state.matches({ idle: 'error' }))
  const isSent = useSelector(service, (state) => state.matches({ idle: 'success' }))
  const error = useSelector(service, (state) => state.context.error)
  const isLoading = useSelector(service, (state) => state.matches('requesting'))

  const sendEmail: SendVerificationEmailHandler = (valueEmail, valueOptions = options) =>
    sendVerificationEmailPromise(service, valueEmail, valueOptions)

  return { sendEmail, isLoading, isSent, isError, error }
}
