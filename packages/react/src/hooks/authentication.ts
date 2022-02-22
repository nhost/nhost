import { useSelector } from '@xstate/react'

import { useAuthenticated, useNhostInterpreter } from './common'

export const useEmailPasswordSignIn = (stateEmail?: string, statePassword?: string) => {
  const service = useNhostInterpreter()
  const signIn = (valueEmail?: string, valuePassword?: string) =>
    service.send({
      type: 'SIGNIN_PASSWORD',
      email: typeof valueEmail === 'string' ? valueEmail : stateEmail,
      password: typeof valuePassword === 'string' ? valuePassword : statePassword
    })

  const error = useSelector(service, (state) => state.context.errors.authentication)
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

  return { signIn, loading, success, needsVerification, hasError, error }
}

export const useEmailPasswordlessSignIn = (stateEmail?: string) => {
  const service = useNhostInterpreter()
  const signIn = (valueEmail?: string) =>
    service.send({
      type: 'SIGNIN_PASSWORDLESS_EMAIL',
      email: typeof valueEmail === 'string' ? valueEmail : stateEmail
    })

  const error = useSelector(service, (state) => state.context.errors.authentication)
  const loading = useSelector(service, (state) =>
    state.matches({ authentication: { authenticating: 'passwordlessEmail' } })
  )
  const sent = useSelector(service, (state) =>
    state.matches({ authentication: { signedOut: 'needsVerification' } })
  )

  const hasError = useSelector(service, (state) =>
    state.matches({ authentication: { signedOut: 'failed' } })
  )
  return { signIn, loading, sent, hasError, error }
}
