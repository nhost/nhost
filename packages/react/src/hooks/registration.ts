import { useMemo } from 'react'

import { SignUpOptions } from '@nhost/core'
import { useSelector } from '@xstate/react'

import { useAuthenticated, useAuthLoading, useNhostInterpreter } from './common'

export const useEmailPasswordSignUp = (
  stateEmail?: string,
  statePassword?: string,
  stateOptions?: SignUpOptions
) => {
  const service = useNhostInterpreter()
  const isError = useSelector(service, (state) =>
    state.matches({ authentication: { signedOut: 'failed' } })
  )
  const error = useSelector(service, (state) => state.context.errors.registration)
  const loading = useAuthLoading()
  const isSuccess = useAuthenticated()
  const isLoading = useMemo(() => loading && !isSuccess, [loading, isSuccess])
  const needsVerification = useSelector(service, (state) =>
    state.matches({ authentication: { signedOut: 'needsVerification' } })
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
    needsVerification
  }
}
