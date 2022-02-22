import { useMemo } from 'react'

import { useSelector } from '@xstate/react'

import { useAuthenticated, useNhostInterpreter, useReady } from './common'

export const useSignUpEmailPassword = (stateEmail?: string, statePassword?: string) => {
  const service = useNhostInterpreter()
  const hasError = useSelector(service, (state) =>
    state.matches({ authentication: { signedOut: 'failed' } })
  )
  const error = useSelector(service, (state) => state.context.errors.authentication)
  const ready = useReady()
  const success = useAuthenticated()
  const loading = useMemo(() => !ready && !success, [ready, success])
  const needsVerification = useSelector(service, (state) =>
    state.matches({ authentication: { signedOut: 'needsVerification' } })
  )

  const signUp = (valueEmail?: string, valuePassword?: string) =>
    service.send({
      type: 'REGISTER',
      email: typeof valueEmail === 'string' ? valueEmail : stateEmail,
      password: typeof valuePassword === 'string' ? valuePassword : statePassword
    })
  return {
    signUp,
    loading,
    success,
    hasError,
    error,
    needsVerification
  }
}
