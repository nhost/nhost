import { computed } from 'vue'

import { SignUpOptions } from '@nhost/core'
import { useSelector } from '@xstate/vue'

import { useAuthenticationStatus, useAuthInterpreter } from './common'

export const useSignUpEmailPassword = (
  stateEmail?: string,
  statePassword?: string,
  stateOptions?: SignUpOptions
) => {
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

  const signUpEmailPassword = (
    valueEmail?: string | unknown,
    valuePassword = statePassword,
    valueOptions = stateOptions
  ) =>
    service.value.send({
      type: 'SIGNUP_EMAIL_PASSWORD',
      email: typeof valueEmail === 'string' ? valueEmail : stateEmail,
      password: valuePassword,
      options: valueOptions
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
