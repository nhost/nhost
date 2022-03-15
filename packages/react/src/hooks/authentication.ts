import { useContext, useMemo } from 'react'

import { encodeQueryParameters, PasswordlessOptions, Provider, ProviderOptions } from '@nhost/core'
import { useSelector } from '@xstate/react'

import { NhostReactContext } from '../provider'

import { useAuthenticated, useAuthInterpreter } from './common'

export const useEmailPasswordSignIn = (
  stateEmail?: string,
  statePassword?: string,
  stateOtp?: string
) => {
  const service = useAuthInterpreter()
  const emailPasswordSignIn = (valueEmail?: string | unknown, valuePassword?: string | unknown) =>
    service.send({
      type: 'SIGNIN_PASSWORD',
      email: typeof valueEmail === 'string' ? valueEmail : stateEmail,
      password: typeof valuePassword === 'string' ? valuePassword : statePassword
    })
  const sendMfaOtp = (valueOtp?: string | unknown) => {
    service.send({
      type: 'SIGNIN_MFA_TOTP',
      otp: typeof valueOtp === 'string' ? valueOtp : stateOtp
    })
  }
  const error = useSelector(
    service,
    (state) => state.context.errors.authentication,
    (a, b) => a?.error === b?.error
  )
  const isSuccess = useAuthenticated()
  const isLoading = useSelector(
    service,
    (state) => state.matches({ authentication: { authenticating: 'password' } }),
    (a, b) => a === b
  )
  const needsEmailVerification = useSelector(
    service,
    (state) => state.matches({ authentication: { signedOut: 'needsEmailVerification' } }),
    (a, b) => a === b
  )
  const needsMfaOtp = useSelector(
    service,
    (state) => state.matches({ authentication: { signedOut: 'needsMfa' } }),
    (a, b) => a === b
  )
  const isError = useSelector(
    service,
    (state) => state.matches({ authentication: { signedOut: 'failed' } }),
    (a, b) => a === b
  )

  return {
    emailPasswordSignIn,
    isLoading,
    isSuccess,
    needsEmailVerification,
    needsMfaOtp,
    sendMfaOtp,
    isError,
    error
  }
}

export const useEmailPasswordlessSignIn = (
  stateEmail?: string,
  stateOptions?: PasswordlessOptions
) => {
  const service = useAuthInterpreter()
  const emailPasswordlessSignIn = (valueEmail?: string | unknown, valueOptions = stateOptions) =>
    service.send({
      type: 'SIGNIN_PASSWORDLESS_EMAIL',
      email: typeof valueEmail === 'string' ? valueEmail : stateEmail,
      options: valueOptions
    })

  const error = useSelector(
    service,
    (state) => state.context.errors.authentication,
    (a, b) => a?.error === b?.error
  )
  const isLoading =
    !!service.status &&
    service.state.matches({ authentication: { authenticating: 'passwordlessEmail' } })
  const isSuccess =
    !!service.status &&
    service.state.matches({ authentication: { signedOut: 'needsEmailVerification' } })

  const isError =
    !!service.status && service.state.matches({ authentication: { signedOut: 'failed' } })
  return { emailPasswordlessSignIn, isLoading, isSuccess, isError, error }
}

// TODO documentation
// TODO deanonymize
export const useAnonymousSignIn = () => {
  const service = useAuthInterpreter()
  const anonymousSignIn = () => service.send('SIGNIN_ANONYMOUS')

  const error = useSelector(
    service,
    (state) => state.context.errors.authentication,
    (a, b) => a?.error === b?.error
  )
  const isLoading =
    !!service.status && service.state.matches({ authentication: { authenticating: 'anonymous' } })
  const isSuccess = useAuthenticated()
  const isError =
    !!service.status && service.state.matches({ authentication: { signedOut: 'failed' } })
  return { anonymousSignIn, isLoading, isSuccess, isError, error }
}

export const useProviderLink = (options?: ProviderOptions) => {
  const nhost = useContext(NhostReactContext)

  return useMemo(
    () =>
      new Proxy({} as Record<Provider, string>, {
        get(_, provider: string) {
          return encodeQueryParameters(
            `${nhost.auth.client.backendUrl}/signin/provider/${provider}`,
            options
          )
        }
      }),
    [nhost, options]
  )
}
