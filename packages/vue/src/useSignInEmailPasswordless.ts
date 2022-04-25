import { unref } from 'vue'

import { PasswordlessOptions } from '@nhost/core'
import { useSelector } from '@xstate/vue'

import { RefOrValue } from './helpers'
import { useAuthInterpreter } from './useAuthInterpreter'

export const useSignInEmailPasswordless = (options?: RefOrValue<PasswordlessOptions>) => {
  const service = useAuthInterpreter()
  const signInEmailPasswordless = (email: RefOrValue<string>) =>
    service.value.send({
      type: 'SIGNIN_PASSWORDLESS_EMAIL',
      email: unref(email),
      options: unref(options)
    })

  const error = useSelector(
    service.value,
    (state) => state.context.errors.authentication,
    (a, b) => a?.error === b?.error
  )
  const isLoading =
    !!service.value.status &&
    service.value.state.matches({ authentication: { authenticating: 'passwordlessEmail' } })
  const isSuccess =
    !!service.value.status &&
    service.value.state.matches({ authentication: { signedOut: 'needsEmailVerification' } })

  const isError =
    !!service.value.status &&
    service.value.state.matches({ authentication: { signedOut: 'failed' } })
  return { signInEmailPasswordless, isLoading, isSuccess, isError, error }
}
