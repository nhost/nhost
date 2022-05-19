import { useContext, useMemo } from 'react'

import {
  encodeQueryParameters,
  PasswordlessOptions,
  Provider,
  ProviderOptions,
  rewriteRedirectTo,
  SignInEmailPasswordHandlerResult,
  SignInEmailPasswordlessHandlerResult,
  SignInEmailPasswordState
} from '@nhost/core'
import {
  signInAnonymousPromise,
  signInEmailPasswordlessPromise,
  signInEmailPasswordPromise
} from '@nhost/core'
import { useSelector } from '@xstate/react'

import { NhostReactContext } from '../provider'

import { useAuthInterpreter } from './common'

interface SignInEmailPasswordHandler {
  (email: string, password: string): Promise<SignInEmailPasswordHandlerResult>
  /** @deprecated */
  (email?: unknown, password?: string): Promise<SignInEmailPasswordHandlerResult>
}

interface SendMfaOtpHander {
  (otp: string): void
  /** @deprecated */
  (otp?: unknown): void
}

interface SignInEmailPasswordHookResult extends SignInEmailPasswordState {
  signInEmailPassword: SignInEmailPasswordHandler
  sendMfaOtp: SendMfaOtpHander
}

interface SignInEmailPasswordHook {
  (): SignInEmailPasswordHookResult
  /** @deprecated */
  (email?: string, password?: string, otp?: string): SignInEmailPasswordHookResult
}

// TODO: Add MFA example once MFA is available at Nhost Cloud.
/**
 * Use the hook `useSignInEmailPassword` to sign in a user using email and password.
 *
 * @example
 * ```tsx
 * const { signInEmailPassword, needsEmailVerification, isLoading, isSuccess, isError, error } = useSignInEmailPassword()
 *
 * console.log({ needsEmailVerification, isLoading, isSuccess, isError, error });
 *
 * const handleFormSubmit = async (e) => {
 *   e.preventDefault();
 *
 *   await signInEmailPassword('joe@example.com','secret-password')
 * }
 * ```
 *
 * @docs https://docs.nhost.io/reference/react/use-sign-in-email-password
 */
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
    signInEmailPasswordPromise(
      service,
      (typeof valueEmail === 'string' ? valueEmail : stateEmail) as string,
      (typeof valuePassword === 'string' ? valuePassword : statePassword) as string
    )

  const sendMfaOtp: SendMfaOtpHander = (valueOtp?: string | unknown) => {
    // TODO promisify
    service.send('SIGNIN_MFA_TOTP', {
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
  const isSuccess = useSelector(service, (state) =>
    state.matches({
      authentication: 'signedIn'
    })
  )
  const isLoading = useSelector(
    service,
    (state) => state.matches({ authentication: { authenticating: 'password' } }),
    (a, b) => a === b
  )
  const needsEmailVerification = useSelector(
    service,
    (state) =>
      state.matches({ authentication: { signedOut: 'noErrors' }, email: 'awaitingVerification' }),
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

  const mfa = useSelector(service, (state) => state.context.mfa)

  return {
    accessToken,
    error,
    isError,
    isLoading,
    isSuccess,
    needsEmailVerification,
    needsMfaOtp,
    mfa,
    sendMfaOtp,
    signInEmailPassword,
    user
  }
}

interface SignInEmailPasswordlessHandler {
  (email: string, options?: PasswordlessOptions): Promise<SignInEmailPasswordlessHandlerResult>
  /** @deprecated */
  (email?: unknown, options?: PasswordlessOptions): Promise<SignInEmailPasswordlessHandlerResult>
}

interface SignInEmailPasswordlessHookResult extends SignInEmailPasswordState {
  /** Sends a magic link to the given email */
  signInEmailPasswordless: SignInEmailPasswordlessHandler
}

/**
 * Use the hook `useSignInEmailPasswordless` to sign in a user using passwordless email (Magic Link).
 *
 * @example
 * ```tsx
 * const { signInEmailPasswordless, isLoading, isSuccess, isError, error } = useSignInEmailPasswordless()
 *
 * console.log({ isLoading, isSuccess, isError, error });
 *
 * const handleFormSubmit = async (e) => {
 *   e.preventDefault();
 *
 *   await signInEmailPasswordless('joe@example.com');
 * }
 * ```
 *
 * @docs https://docs.nhost.io/reference/react/use-sign-in-email-passwordless
 */
export function useSignInEmailPasswordless(
  options?: PasswordlessOptions
): SignInEmailPasswordlessHookResult

/**
 * @deprecated
 */
export function useSignInEmailPasswordless(
  email?: string,
  options?: PasswordlessOptions
): SignInEmailPasswordlessHookResult

export function useSignInEmailPasswordless(
  a?: string | PasswordlessOptions,
  b?: PasswordlessOptions
) {
  const stateEmail = typeof a === 'string' ? a : undefined
  const stateOptions = typeof a === 'string' ? b : a
  const service = useAuthInterpreter()

  const signInEmailPasswordless: SignInEmailPasswordlessHandler = (
    valueEmail?: string | unknown,
    valueOptions = stateOptions
  ) =>
    signInEmailPasswordlessPromise(
      service,
      (typeof valueEmail === 'string' ? valueEmail : stateEmail) as string,
      valueOptions
    )

  const error = useSelector(
    service,
    (state) => state.context.errors.signUp || null,
    (a, b) => a?.error === b?.error
  )
  const isLoading = useSelector(service, (state) => state.matches('signUp.passwordlessEmail'))

  const isSuccess = useSelector(service, (state) =>
    state.matches({
      signUp: { incomplete: 'noError' },
      email: 'awaitingVerification'
    })
  )

  const isError = useSelector(service, (state) => state.matches('signUp.incomplete.failed'))

  return { signInEmailPasswordless, isLoading, isSuccess, isError, error }
}

// TODO document when available in Nhost Cloud
export const useSignInAnonymous = () => {
  const service = useAuthInterpreter()
  const signInAnonymous = () => signInAnonymousPromise(service)

  const error = useSelector(
    service,
    (state) => state.context.errors.authentication || null,
    (a, b) => a?.error === b?.error
  )
  const isLoading = useSelector(service, (state) =>
    state.matches({ authentication: { authenticating: 'anonymous' } })
  )
  const isSuccess = useSelector(service, (state) =>
    state.matches({
      authentication: 'signedIn'
    })
  )
  const isError = useSelector(service, (state) =>
    state.matches({ authentication: { signedOut: 'failed' } })
  )
  const user = useSelector(
    service,
    (state) => state.context.user,
    (a, b) => a?.id === b?.id
  )
  const accessToken = useSelector(service, (state) => state.context.accessToken.value)
  return { accessToken, error, isError, isLoading, isSuccess, signInAnonymous, user }
}

/**
 *  Use the hook `useProviderLink` to get an OAuth provider URL that can be used to sign in users.
 *
 * @example
 * ```js
 * const providerLink = useProviderLink();
 * ```
 *
 * @example
 * ```jsx
 * import { useProviderLink } from '@nhost/react';
 *
 * const Component = () => {
 *   const { facebook, github } = useProviderLink();
 *
 *   return (
 *     <div>
 *       <a href={facebook}>Sign in with Facebook</a>
 *       <a href={github}>Sign in with GitHub</a>
 *     </div>
 *   );
 * };
 * ```
 */
export const useProviderLink = (options?: ProviderOptions) => {
  const nhost = useContext(NhostReactContext)

  return useMemo(
    () =>
      new Proxy({} as Record<Provider, string>, {
        get(_, provider: string) {
          return encodeQueryParameters(
            `${nhost.auth.client.backendUrl}/signin/provider/${provider}`,
            rewriteRedirectTo(nhost.auth.client.clientUrl, options as any)
          )
        }
      }),
    [nhost, options]
  )
}
