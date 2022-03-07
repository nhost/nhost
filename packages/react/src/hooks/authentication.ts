import { PasswordlessOptions, Provider } from '@nhost/core'
import { useSelector } from '@xstate/react'

import { useNhost } from './common'
import { useAuthenticated, useNhostInterpreter } from './common'

export const useEmailPasswordSignIn = (stateEmail?: string, statePassword?: string) => {
  const service = useNhostInterpreter()
  const signIn = (valueEmail?: string | unknown, valuePassword?: string | unknown) =>
    service.send({
      type: 'SIGNIN_PASSWORD',
      email: typeof valueEmail === 'string' ? valueEmail : stateEmail,
      password: typeof valuePassword === 'string' ? valuePassword : statePassword
    })

  const error = useSelector(service, (state) => state.context.errors.authentication)
  const isSuccess = useAuthenticated()
  const isLoading = useSelector(service, (state) =>
    state.matches({ authentication: { authenticating: 'password' } })
  )
  const needsVerification = useSelector(service, (state) =>
    state.matches({ authentication: { signedOut: 'needsVerification' } })
  )

  const isError = useSelector(service, (state) =>
    state.matches({ authentication: { signedOut: 'failed' } })
  )

  return { signIn, isLoading, isSuccess, needsVerification, isError, error }
}

export const useEmailPasswordlessSignIn = (
  stateEmail?: string,
  stateOptions?: PasswordlessOptions
) => {
  const service = useNhostInterpreter()
  const signIn = (valueEmail?: string | unknown, valueOptions = stateOptions) =>
    service.send({
      type: 'SIGNIN_PASSWORDLESS_EMAIL',
      email: typeof valueEmail === 'string' ? valueEmail : stateEmail,
      options: valueOptions
    })

  const error = useSelector(service, (state) => state.context.errors.authentication)
  const isLoading = useSelector(service, (state) =>
    state.matches({ authentication: { authenticating: 'passwordlessEmail' } })
  )
  const isSuccess = useSelector(service, (state) =>
    state.matches({ authentication: { signedOut: 'needsVerification' } })
  )

  const isError = useSelector(service, (state) =>
    state.matches({ authentication: { signedOut: 'failed' } })
  )
  return { signIn, isLoading, isSuccess, isError, error }
}

// TODO documentation
// TODO deanonymize
export const useAnonymousSignIn = () => {
  const service = useNhostInterpreter()
  const signIn = () => service.send('SIGNIN_ANONYMOUS')

  const error = useSelector(service, (state) => state.context.errors.authentication)
  const isLoading = useSelector(service, (state) =>
    state.matches({ authentication: { authenticating: 'anonymous' } })
  )
  const isSuccess = useAuthenticated()

  const isError = useSelector(service, (state) =>
    state.matches({ authentication: { signedOut: 'failed' } })
  )
  return { signIn, isLoading, isSuccess, isError, error }
}

export const useProviderLink = () => {
  const nhost = useNhost()
  return new Proxy({} as Record<Provider, string>, {
    get(_, provider: string) {
      return `${nhost.backendUrl}/v1/auth/signin/provider/${provider}`
    }
  })
}
