import { useContext, useMemo } from 'react'

import {
  encodeQueryParameters,
  PasswordlessOptions,
  Provider,
  ProviderOptions,
  rewriteRedirectTo,
  User
} from '@nhost/core'
import { useSelector } from '@xstate/react'

import { NhostReactContext } from '../provider'

import { ActionHookState, useAuthenticated, useAuthInterpreter } from './common'

type SignInEmailPasswordHookState = ActionHookState & {
  needsMfaOtp: boolean
  needsEmailVerification: boolean
  user: User | null
  accessToken: string | null
}

type SignInEmailPasswordHandlerResult = Omit<SignInEmailPasswordHookState, 'isLoading'>

type SignInEmailPasswordHandler = {
  (email: string, password: string): Promise<SignInEmailPasswordHandlerResult>
  /** @deprecated */
  (email?: unknown, password?: string): Promise<SignInEmailPasswordHandlerResult>
}

type SendMfaOtpHander = {
  (otp: string): void
  /** @deprecated */
  (otp?: unknown): void
}

type SignInEmailPasswordHookResult = {
  signInEmailPassword: SignInEmailPasswordHandler
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
  const signInEmailPassword: SignInEmailPasswordHandler = (
    valueEmail?: string | unknown,
    valuePassword?: string
  ) =>
    new Promise<SignInEmailPasswordHandlerResult>((resolve) => {
      service.send({
        type: 'SIGNIN_PASSWORD',
        email: typeof valueEmail === 'string' ? valueEmail : stateEmail,
        password: typeof valuePassword === 'string' ? valuePassword : statePassword
      })
      service.onTransition((state) => {
        if (state.matches({ authentication: { signedOut: 'needsEmailVerification' } })) {
          resolve({
            accessToken: null,
            error: null,
            isError: false,
            isSuccess: false,
            needsEmailVerification: true,
            needsMfaOtp: false,
            user: null
          })
        } else if (state.matches({ authentication: { signedOut: 'needsMfa' } })) {
          resolve({
            accessToken: null,
            error: null,
            isError: false,
            isSuccess: false,
            needsEmailVerification: false,
            needsMfaOtp: true,
            user: null
          })
        } else if (state.matches({ authentication: { signedOut: 'failed' } })) {
          resolve({
            accessToken: null,
            error: state.context.errors.authentication || null,
            isError: true,
            isSuccess: false,
            needsEmailVerification: false,
            needsMfaOtp: false,
            user: null
          })
        } else if (state.matches({ authentication: 'signedIn' })) {
          resolve({
            accessToken: state.context.accessToken.value,
            error: null,
            isError: false,
            isSuccess: true,
            needsEmailVerification: false,
            needsMfaOtp: false,
            user: state.context.user
          })
        }
      })
    })

  const sendMfaOtp: SendMfaOtpHander = (valueOtp?: string | unknown) => {
    service.send({
      type: 'SIGNIN_MFA_TOTP',
      otp: typeof valueOtp === 'string' ? valueOtp : stateOtp
    })
  }
  const user = useSelector(
    service,
    (state) => state.context.user,
    (a, b) => a?.id === b?.id
  )
  const accessToken = useSelector(service, (state) => state.context.accessToken.value)
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
    accessToken,
    error,
    isError,
    isLoading,
    isSuccess,
    needsEmailVerification,
    needsMfaOtp,
    sendMfaOtp,
    signInEmailPassword,
    user
  }
}

type SignInEmailPasswordlessHandlerResult = Omit<ActionHookState, 'isLoading'>
type SignInEmailPasswordlessHandler = {
  (email: string, options?: PasswordlessOptions): Promise<SignInEmailPasswordlessHandlerResult>
  /** @deprecated */
  (email?: unknown, options?: PasswordlessOptions): Promise<SignInEmailPasswordlessHandlerResult>
}

type SignInEmailPasswordlessHookResult = {
  signInEmailPasswordless: SignInEmailPasswordlessHandler
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

  const signInEmailPasswordless: SignInEmailPasswordlessHandler = (
    valueEmail?: string | unknown,
    valueOptions = stateOptions
  ) =>
    new Promise<SignInEmailPasswordlessHandlerResult>((resolve) => {
      service.send({
        type: 'SIGNIN_PASSWORDLESS_EMAIL',
        email: typeof valueEmail === 'string' ? valueEmail : stateEmail,
        options: valueOptions
      })
      service.onTransition((state) => {
        if (state.matches({ authentication: { signedOut: 'failed' } })) {
          resolve({
            error: state.context.errors.authentication || null,
            isError: true,
            isSuccess: false
          })
        } else if (state.matches({ authentication: { signedOut: 'needsEmailVerification' } })) {
          resolve({ error: null, isError: false, isSuccess: true })
        }
      })
    })

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
  const user = useSelector(
    service,
    (state) => state.context.user,
    (a, b) => a?.id === b?.id
  )
  const accessToken = useSelector(service, (state) => state.context.accessToken.value)
  return { accessToken, error, isError, isLoading, isSuccess, signInAnonymous, user }
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
