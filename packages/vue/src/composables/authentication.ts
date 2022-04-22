import { PasswordlessOptions, ProviderOptions } from '@nhost/core'
import { useSelector } from '@xstate/vue'

import { useAuthenticated, useAuthInterpreter, useNhostClient } from './common'

export const useSignInEmailPassword = (
  stateEmail?: string,
  statePassword?: string,
  stateOtp?: string
) => {
  const service = useAuthInterpreter()
  const signInEmailPassword = (valueEmail?: string | unknown, valuePassword?: string | unknown) =>
    service.value.send({
      type: 'SIGNIN_PASSWORD',
      email: typeof valueEmail === 'string' ? valueEmail : stateEmail,
      password: typeof valuePassword === 'string' ? valuePassword : statePassword
    })
  const sendMfaOtp = (valueOtp?: string | unknown) => {
    service.value.send({
      type: 'SIGNIN_MFA_TOTP',
      otp: typeof valueOtp === 'string' ? valueOtp : stateOtp
    })
  }
  const error = useSelector(
    service.value,
    (state) => state.context.errors.authentication,
    (a, b) => a?.error === b?.error
  )
  const isSuccess = useAuthenticated()
  const isLoading = useSelector(
    service.value,
    (state) => state.matches({ authentication: { authenticating: 'password' } }),
    (a, b) => a === b
  )
  const needsEmailVerification = useSelector(
    service.value,
    (state) => state.matches({ authentication: { signedOut: 'needsEmailVerification' } }),
    (a, b) => a === b
  )
  const needsMfaOtp = useSelector(
    service.value,
    (state) => state.matches({ authentication: { signedOut: 'needsMfa' } }),
    (a, b) => a === b
  )
  const isError = useSelector(
    service.value,
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

export const useSignInEmailPasswordless = (
  stateEmail?: string,
  stateOptions?: PasswordlessOptions
) => {
  const service = useAuthInterpreter()
  const signInEmailPasswordless = (valueEmail?: string | unknown, valueOptions = stateOptions) =>
    service.value.send({
      type: 'SIGNIN_PASSWORDLESS_EMAIL',
      email: typeof valueEmail === 'string' ? valueEmail : stateEmail,
      options: valueOptions
    })

  const error = useSelector(
    service.value,
    (state) => state.context.errors.authentication,
    (a, b) => a?.error === b?.error
  )
  const isLoading =
    !!service.value.status &&
    service.value.state.matches({ authentication: { authenticating: 'passwordlessEmail' } })
  const isSuccess =
    !!service.value.status &&
    service.value.state.matches({ authentication: { signedOut: 'needsEmailVerification' } })

  const isError =
    !!service.value.status &&
    service.value.state.matches({ authentication: { signedOut: 'failed' } })
  return { signInEmailPasswordless, isLoading, isSuccess, isError, error }
}

// TODO documentation when available in Nhost Cloud - see changelog
// TODO deanonymize
export const useSignInAnonymous = () => {
  const service = useAuthInterpreter()
  const signInAnonymous = () => service.value.send('SIGNIN_ANONYMOUS')

  const error = useSelector(
    service.value,
    (state) => state.context.errors.authentication,
    (a, b) => a?.error === b?.error
  )
  const isLoading =
    !!service.value.status &&
    service.value.state.matches({ authentication: { authenticating: 'anonymous' } })
  const isSuccess = useAuthenticated()
  const isError =
    !!service.value.status &&
    service.value.state.matches({ authentication: { signedOut: 'failed' } })
  return { signInAnonymous, isLoading, isSuccess, isError, error }
}

export const useProviderLink = (options?: ProviderOptions) => {
  const nhost = useNhostClient()
  // TODO
  return {}
  // return useMemo(
  //   () =>
  //     new Proxy({} as Record<Provider, string>, {
  //       get(_, provider: string) {
  //         return encodeQueryParameters(
  //           `${nhost.value.auth.client.backendUrl}/signin/provider/${provider}`,
  //           rewriteRedirectTo(nhost.value.auth.client.clientUrl, options)
  //         )
  //       }
  //     }),
  //   [nhost, options]
  // )
}
