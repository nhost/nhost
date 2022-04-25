import { computed, unref } from 'vue'

import { SignUpOptions } from '@nhost/core'
import { useSelector } from '@xstate/vue'

import { RefOrValue } from './helpers'
import { useAuthenticationStatus } from './useAuthenticationStatus'
import { useAuthInterpreter } from './useAuthInterpreter'

export const useSignUpEmailPassword = (options?: RefOrValue<SignUpOptions>) => {
  const service = useAuthInterpreter()
  const isError =
    !!service.value.status &&
    service.value.state.matches({ authentication: { signedOut: 'failed' } })
  const error = useSelector(
    service.value,
    (state) => state.context.errors.registration,
    (a, b) => a?.error === b?.error
  )

  const { isLoading: loading, isAuthenticated: isSuccess } = useAuthenticationStatus()

  const isLoading = computed(() => loading.value && !isSuccess.value)
  const needsEmailVerification =
    !!service.value.status &&
    service.value.state.matches({ authentication: { signedOut: 'needsEmailVerification' } })

  const signUpEmailPassword = (email: RefOrValue<string>, password: RefOrValue<string>) =>
    service.value.send({
      type: 'SIGNUP_EMAIL_PASSWORD',
      email: unref(email),
      password: unref(password),
      options: unref(options)
    })
  return {
    signUpEmailPassword,
    isLoading,
    isSuccess,
    isError,
    error,
    needsEmailVerification
  }
}
