import { useMemo } from 'react'

import { useSelector } from '@xstate/react'

import { useAuthenticated, useLoading, useNhostInterpreter } from './common'

export const useEmailPasswordSignUp = (stateEmail?: string, statePassword?: string) => {
  const service = useNhostInterpreter()
  const isError = useSelector(service, (state) =>
    state.matches({ authentication: { signedOut: 'failed' } })
  )
  const error = useSelector(service, (state) => state.context.errors.authentication)
  const loading = useLoading()
  const isSuccess = useAuthenticated()
  const isLoading = useMemo(() => loading && !isSuccess, [loading, isSuccess])
  const needsVerification = useSelector(service, (state) =>
    state.matches({ authentication: { signedOut: 'needsVerification' } })
  )

  const signUp = (valueEmail?: string | unknown, valuePassword?: string | unknown) =>
    service.send({
      type: 'REGISTER',
      email: typeof valueEmail === 'string' ? valueEmail : stateEmail,
      password: typeof valuePassword === 'string' ? valuePassword : statePassword
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
