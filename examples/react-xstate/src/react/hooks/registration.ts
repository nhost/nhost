import { useSelector } from '@xstate/react'
import { useMemo } from 'react'
import { useAuthenticated, useAuthService, useReady } from './common'

export const useSignUpEmailPassword = (email: string, password: string) => {
  const service = useAuthService()
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

  const signUp = () =>
    service.send({
      type: 'REGISTER',
      email,
      password
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
