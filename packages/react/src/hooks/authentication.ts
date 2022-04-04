import { useContext, useMemo } from 'react'

import {
  encodeQueryParameters,
  PasswordlessOptions,
  Provider,
  ProviderOptions,
  rewriteRedirectTo
} from '@nhost/core'
import { useSelector } from '@xstate/react'

import { NhostReactContext } from '../provider'

import { ActionHookState, useAuthenticated, useAuthInterpreter } from './common'

type SignInEmailPasswordHookState = ActionHookState & {
  needsMfaOtp: boolean
  needsEmailVerification: boolean
}

type SignInEmailPasswordHookHandler = {
  (email: string, password: string, otp?: string): void
  /** @deprecated */
  (email?: unknown, password?: string, otp?: string): void
}

type SendMfaOtpHander = {
  (otp: string): void
  /** @deprecated */
  (otp?: unknown): void
}

type SignInEmailPasswordHookResult = {
  signInEmailPassword: SignInEmailPasswordHookHandler
  sendMfaOtp: SendMfaOtpHander
} & SignInEmailPasswordHookState

type SignInEmailPasswordHook = {
  (): SignInEmailPasswordHookResult
  /** @deprecated */
  (email?: string, password?: string, otp?: string): SignInEmailPasswordHookResult
}

export const useSignInEmailPassword: SignInEmailPasswordHook = (
  stateEmail?: string,
  statePassword?: string,
  stateOtp?: string
) => {
  const service = useAuthInterpreter()
  const signInEmailPassword: SignInEmailPasswordHookHandler = (valueEmail, valuePassword) => {
    service.send({
      type: 'SIGNIN_PASSWORD',
      email: typeof valueEmail === 'string' ? valueEmail : stateEmail,
      password: typeof valuePassword === 'string' ? valuePassword : statePassword
    })
  }

  const sendMfaOtp: SendMfaOtpHander = (valueOtp) => {
    service.send({
      type: 'SIGNIN_MFA_TOTP',
      otp: typeof valueOtp === 'string' ? valueOtp : stateOtp
    })
  }
  const error = useSelector(
    service,
    (state) => state.context.errors.authentication || null,
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
    signInEmailPassword,
    isLoading,
    isSuccess,
    needsEmailVerification,
    needsMfaOtp,
    sendMfaOtp,
    isError,
    error
  }
}

type SignInEmailPasswordlessHookHandler = {
  (email: string, options?: PasswordlessOptions): void
  /** @deprecated */
  (email?: unknown, options?: PasswordlessOptions): void
}

type SignInEmailPasswordlessHookResult = {
  signInEmailPasswordless: SignInEmailPasswordlessHookHandler
} & ActionHookState

type SignInEmailPasswordlessdHook = {
  (options?: PasswordlessOptions): SignInEmailPasswordlessHookResult
  /** @deprecated */
  (email?: string, options?: PasswordlessOptions): SignInEmailPasswordlessHookResult
}

export const useSignInEmailPasswordless: SignInEmailPasswordlessdHook = (
  a?: string | PasswordlessOptions,
  b?: PasswordlessOptions
) => {
  const stateEmail = typeof a === 'string' ? a : undefined
  const stateOptions = typeof a === 'string' ? b : a
  const service = useAuthInterpreter()
  const signInEmailPasswordless: SignInEmailPasswordlessHookHandler = (
    valueEmail,
    valueOptions = stateOptions
  ) => {
    service.send({
      type: 'SIGNIN_PASSWORDLESS_EMAIL',
      email: typeof valueEmail === 'string' ? valueEmail : stateEmail,
      options: valueOptions
    })
  }

  const error = useSelector(
    service,
    (state) => state.context.errors.authentication || null,
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
  return { signInEmailPasswordless, isLoading, isSuccess, isError, error }
}

// TODO documentation when available in Nhost Cloud - see changelog
// TODO deanonymize
export const useSignInAnonymous = () => {
  const service = useAuthInterpreter()
  const signInAnonymous = () => service.send('SIGNIN_ANONYMOUS')

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
  return { signInAnonymous, isLoading, isSuccess, isError, error }
}

export const useProviderLink = (options?: ProviderOptions) => {
  const nhost = useContext(NhostReactContext)

  return useMemo(
    () =>
      new Proxy({} as Record<Provider, string>, {
        get(_, provider: string) {
          return encodeQueryParameters(
            `${nhost.auth.client.backendUrl}/signin/provider/${provider}`,
            rewriteRedirectTo(nhost.auth.client.clientUrl, options)
          )
        }
      }),
    [nhost, options]
  )
}
