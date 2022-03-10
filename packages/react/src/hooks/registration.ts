import { useMemo } from 'react'

import { SignUpOptions } from '@nhost/core'
import { useSelector } from '@xstate/react'

import { useAuthenticated, useAuthInterpreter, useAuthLoading } from './common'

export const useEmailPasswordSignUp = (
  stateEmail?: string,
  statePassword?: string,
  stateOptions?: SignUpOptions
) => {
  const service = useAuthInterpreter()
  const isError = useSelector(service, (state) =>
    state.matches({ authentication: { signedOut: 'failed' } })
  )
  const error = useSelector(service, (state) => state.context.errors.registration)
  const loading = useAuthLoading()
  const isSuccess = useAuthenticated()
  const isLoading = useMemo(() => loading && !isSuccess, [loading, isSuccess])
  const needsEmailVerification = useSelector(service, (state) =>
    state.matches({ authentication: { signedOut: 'needsEmailVerification' } })
  )

  const signUp = (
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
    signUp,
    isLoading,
    isSuccess,
    isError,
    error,
    needsEmailVerification
  }
}
