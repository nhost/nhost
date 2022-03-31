import { useMemo } from 'react'

import { SignUpOptions } from '@nhost/core'
import { useSelector } from '@xstate/react'

import { useAuthenticationStatus, useAuthInterpreter } from './common'

export const useSignUpEmailPassword = (
  stateEmail?: string,
  statePassword?: string,
  stateOptions?: SignUpOptions
) => {
  const service = useAuthInterpreter()
  const isError =
    !!service.status && service.state.matches({ authentication: { signedOut: 'failed' } })
  const error = useSelector(
    service,
    (state) => state.context.errors.registration,
    (a, b) => a?.error === b?.error
  )
  const { isLoading: loading, isAuthenticated: isSuccess } = useAuthenticationStatus()
  const isLoading = useMemo(() => loading && !isSuccess, [loading, isSuccess])
  const needsEmailVerification =
    !!service.status &&
    service.state.matches({ authentication: { signedOut: 'needsEmailVerification' } })

  const signUpEmailPassword = (
    valueEmail?: string | unknown,
    valuePassword = statePassword,
    valueOptions = stateOptions
  ) =>
    service.send({
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
