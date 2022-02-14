import { useSelector } from '@xstate/react'

import { useAuthenticated, useNhostInterpreter } from './common'

export const useEmailPasswordSignIn = (email: string, password: string) => {
  const service = useNhostInterpreter()
  const signIn = () =>
    service.send({
      type: 'SIGNIN_PASSWORD',
      email,
      password
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

export const useEmailPasswordlessSignIn = (email: string) => {
  const service = useNhostInterpreter()
  const signIn = () =>
    service.send({
      type: 'SIGNIN_PASSWORDLESS_EMAIL',
      email
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
