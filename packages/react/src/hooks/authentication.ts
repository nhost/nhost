import { PasswordlessOptions, Provider } from '@nhost/core'
import { useSelector } from '@xstate/react'

import { useNhostBackendUrl } from './common'
import { useAuthenticated, useAuthInterpreter } from './common'

export const useEmailPasswordSignIn = (stateEmail?: string, statePassword?: string, stateOtp?: string) => {
  const service = useAuthInterpreter()
  const signIn = (valueEmail?: string | unknown, valuePassword?: string | unknown) =>
    service.send({
      type: 'SIGNIN_PASSWORD',
      email: typeof valueEmail === 'string' ? valueEmail : stateEmail,
      password: typeof valuePassword === 'string' ? valuePassword : statePassword
    })
  const sendMfaOtp = (valueOtp?: string | unknown) => {
    service.send({ type: 'SIGNIN_MFA_TOTP', otp: typeof valueOtp === 'string' ? valueOtp : stateOtp })
  }
  const error = useSelector(service, (state) => state.context.errors.authentication)
  const isSuccess = useAuthenticated()
  const isLoading = useSelector(service, (state) =>
    state.matches({ authentication: { authenticating: 'password' } })
  )
  const needsEmailVerification = useSelector(service, (state) =>
    state.matches({ authentication: { signedOut: 'needsEmailVerification' } })
  )
  const needsMfaOtp = useSelector(service, (state) =>
    state.matches({ authentication: { signedOut: 'needsMfa' } })
  )
  const isError = useSelector(service, (state) =>
    state.matches({ authentication: { signedOut: 'failed' } })
  )

  return { signIn, isLoading, isSuccess, needsEmailVerification, needsMfaOtp, sendMfaOtp, isError, error }
}

export const useEmailPasswordlessSignIn = (
  stateEmail?: string,
  stateOptions?: PasswordlessOptions
) => {
  const service = useAuthInterpreter()
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
    state.matches({ authentication: { signedOut: 'needsEmailVerification' } })
  )

  const isError = useSelector(service, (state) =>
    state.matches({ authentication: { signedOut: 'failed' } })
  )
  return { signIn, isLoading, isSuccess, isError, error }
}

// TODO documentation
// TODO deanonymize
export const useAnonymousSignIn = () => {
  const service = useAuthInterpreter()
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
  const backendUrl = useNhostBackendUrl()
  return new Proxy({} as Record<Provider, string>, {
    get(_, provider: string) {
      return `${backendUrl}/v1/auth/signin/provider/${provider}`
    }
  })
}

