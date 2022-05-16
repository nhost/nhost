import { ToRefs, unref } from 'vue'

import {
  createResetPasswordMachine,
  ResetPasswordHandlerResult,
  ResetPasswordOptions,
  resetPasswordPromise,
  ResetPasswordState
} from '@nhost/core'
import { useInterpret, useSelector } from '@xstate/vue'

import { RefOrValue } from './helpers'
import { useNhostClient } from './useNhostClient'

interface ResetPasswordResult extends ToRefs<ResetPasswordState> {
  resetPassword: (email: RefOrValue<string>) => Promise<ResetPasswordHandlerResult>
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
): ResetPasswordResult => {
  const { nhost } = useNhostClient()
  const service = useInterpret(createResetPasswordMachine(nhost.auth.client))

  const isLoading = useSelector(service, (state) => state.matches('requesting'))
  const isSent = useSelector(service, (state) => state.matches({ idle: 'success' }))
  const isError = useSelector(service, (state) => state.matches({ idle: 'error' }))
  const error = useSelector(service, (state) => state.context.error)

  const resetPassword = (email: RefOrValue<string>) =>
    resetPasswordPromise(service, unref(email), unref(options))

  return { resetPassword, isLoading, isError, isSent, error }
}
