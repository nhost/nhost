import {
  ChangeEmailHandlerResult,
  ChangeEmailOptions,
  changeEmailPromise,
  ChangeEmailState,
  createChangeEmailMachine
} from '@nhost/nhost-js'
import { useInterpret, useSelector } from '@xstate/react'
import { useCallback, useMemo } from 'react'
import { useNhostClient } from './useNhostClient'

interface ChangeEmailHandler {
  (email: string, options?: ChangeEmailOptions): Promise<ChangeEmailHandlerResult>
}

export interface ChangeEmailHookResult extends ChangeEmailState {
  /** Requests the email change. Returns a promise with the current context  */
  changeEmail: ChangeEmailHandler
}

/**
 * Use the hook `useChangeEmail` to change email for the user.
 *
 * @example
 * ```tsx
 * const { changeEmail, isLoading, needsEmailVerification, isError, error } = useChangeEmail();
 *
 * console.log({ isLoading, needsEmailVerification, isError, error });
 *
 * const handleFormSubmit = async (e) => {
 *   e.preventDefault();
 *
 *   await changeEmail('new@example.com')
 * }
 * ```
 *
 * @docs https://docs.nhost.io/reference/react/use-change-email
 */
export function useChangeEmail(options?: ChangeEmailOptions) {
  const nhost = useNhostClient()
  const machine = useMemo(() => createChangeEmailMachine(nhost.auth.client), [nhost])

  const service = useInterpret(machine)

  const isLoading = useSelector(service, (s) => s.matches('requesting'))
  const error = useSelector(service, (state) => state.context.error)
  const isError = useSelector(service, (state) => state.matches('idle.error'))
  const needsEmailVerification = useSelector(service, (state) => state.matches('idle.success'))

  const changeEmail: ChangeEmailHandler = useCallback(
    async (valueEmail, valueOptions = options) =>
      changeEmailPromise(service, valueEmail, valueOptions),
    [service, options]
  )

  return { changeEmail, isLoading, needsEmailVerification, isError, error }
}
