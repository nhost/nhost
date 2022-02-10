import { useSelector } from '@xstate/react'
import { useAuthenticated, useAuthService } from './common'

export const useEmailPasswordSignIn = (email: string, password: string) => {
  const service = useAuthService()
  const signIn = () =>
    service.send({
      type: 'SIGNIN_PASSWORD',
      email,
      password
    })

  const error = useSelector(service, (state) => state.context.errors.authentication)
  const isValid = useSelector(
    service,
    (state) => !state.matches({ authentication: { signedOut: 'invalid' } })
  )
  const success = useAuthenticated()
  const loading = useSelector(service, (state) =>
    state.matches({ authentication: { authenticating: 'password' } })
  )
  const needsVerification = useSelector(service, (state) =>
    state.matches({ authentication: { signedOut: 'needsVerification' } })
  )

  const hasError = useSelector(service, (state) =>
    state.matches({ authentication: { signedOut: 'failed' } })
  )

  return { signIn, loading, success, needsVerification, hasError, error, isValid }
}

export const useEmailPasswordlessSignIn = (email: string) => {
  const service = useAuthService()
  const signIn = () =>
    service.send({
      type: 'SIGNIN_PASSWORDLESS_EMAIL',
      email
    })

  const error = useSelector(service, (state) => state.context.errors.authentication)
  const isValid = useSelector(
    service,
    (state) => !state.matches({ authentication: { signedOut: 'invalid' } })
  )
  const loading = useSelector(service, (state) =>
    state.matches({ authentication: { authenticating: 'passwordlessEmail' } })
  )
  const sent = useSelector(service, (state) =>
    state.matches({ authentication: { signedOut: 'needsVerification' } })
  )

  const hasError = useSelector(service, (state) =>
    state.matches({ authentication: { signedOut: 'failed' } })
  )
  return { signIn, loading, sent, hasError, error, isValid }
}
