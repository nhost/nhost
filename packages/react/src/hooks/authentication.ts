import { useContext, useMemo } from 'react'

import {
  encodeQueryParameters,
  PasswordlessOptions,
  Provider,
  ProviderOptions,
  rewriteRedirectTo,
  User,
  USER_ALREADY_SIGNED_IN
} from '@nhost/core'
import { useSelector } from '@xstate/react'

import { NhostReactContext } from '../provider'

import {
  ActionHookSuccessState,
  CommonActionHookState,
  DefaultActionHookState,
  useAuthInterpreter
} from './common'

interface SignInHookState extends CommonActionHookState, ActionHookSuccessState {
  user: User | null
  accessToken: string | null
}
interface SignInEmailPasswordHookState extends SignInHookState {
  needsMfaOtp: boolean
  needsEmailVerification: boolean
}

type SignInEmailPasswordHandlerResult = Omit<SignInEmailPasswordHookState, 'isLoading'>

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

interface SignInEmailPasswordHookResult extends SignInEmailPasswordHookState {
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
    new Promise<SignInEmailPasswordHandlerResult>((resolve) => {
      const { changed, context } = service.send({
        type: 'SIGNIN_PASSWORD',
        email: typeof valueEmail === 'string' ? valueEmail : stateEmail,
        password: typeof valuePassword === 'string' ? valuePassword : statePassword
      })
      if (!changed) {
        return resolve({
          accessToken: context.accessToken.value,
          error: USER_ALREADY_SIGNED_IN,
          isError: true,
          isSuccess: false,
          needsEmailVerification: false,
          needsMfaOtp: false,
          user: context.user
        })
      }
      service.onTransition((state) => {
        if (
          state.matches({
            authentication: { signedOut: 'noErrors' },
            email: 'awaitingVerification'
          })
        ) {
          // TODO consider sending an error when email needs verification or user needs MFA (breaking change)
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
    // TODO promisify
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

type SignInEmailPasswordlessState = DefaultActionHookState
type SignInEmailPasswordlessHandlerResult = Omit<SignInEmailPasswordlessState, 'isLoading'>
interface SignInEmailPasswordlessHandler {
  (email: string, options?: PasswordlessOptions): Promise<SignInEmailPasswordlessHandlerResult>
  /** @deprecated */
  (email?: unknown, options?: PasswordlessOptions): Promise<SignInEmailPasswordlessHandlerResult>
}

interface SignInEmailPasswordlessHookResult extends DefaultActionHookState {
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
    new Promise<SignInEmailPasswordlessHandlerResult>((resolve) => {
      const { changed } = service.send({
        type: 'SIGNIN_PASSWORDLESS_EMAIL',
        email: typeof valueEmail === 'string' ? valueEmail : stateEmail,
        options: valueOptions
      })
      if (!changed) {
        return resolve({
          error: USER_ALREADY_SIGNED_IN,
          isError: true,
          isSuccess: false
        })
      }
      service.onTransition((state) => {
        if (state.matches({ authentication: { signedOut: 'failed' } })) {
          resolve({
            error: state.context.errors.authentication || null,
            isError: true,
            isSuccess: false
          })
        } else if (
          state.matches({
            authentication: { signedOut: 'noErrors' },
            email: 'awaitingVerification'
          })
        ) {
          resolve({ error: null, isError: false, isSuccess: true })
        }
      })
    })

  const error = useSelector(
    service,
    (state) => state.context.errors.authentication || null,
    (a, b) => a?.error === b?.error
  )
  const isLoading = useSelector(service, (state) =>
    state.matches({ authentication: { authenticating: 'passwordlessEmail' } })
  )

  const isSuccess = useSelector(service, (state) =>
    state.matches({
      authentication: { signedOut: 'noErrors' },
      email: 'awaitingVerification'
    })
  )

  const isError = useSelector(service, (state) =>
    state.matches({ authentication: { signedOut: 'failed' } })
  )

  return { signInEmailPasswordless, isLoading, isSuccess, isError, error }
}

// TODO documentation when available in Nhost Cloud - see changelog
// TODO deanonymize
// TODO review nhost.auth.signIn()

interface SignInAnonymousHookState extends DefaultActionHookState {
  user: User | null
  accessToken: string | null
}
type SignInAnonymousHandlerResult = Omit<SignInAnonymousHookState, 'isLoading'>
interface SignInAnonymousHookResult extends SignInAnonymousHookState {
  signInAnonymous(): Promise<SignInAnonymousHandlerResult>
}

export const useSignInAnonymous = (): SignInAnonymousHookResult => {
  const service = useAuthInterpreter()
  const signInAnonymous = (): Promise<SignInAnonymousHandlerResult> =>
    new Promise((resolve) => {
      const { changed } = service.send('SIGNIN_ANONYMOUS')
      if (!changed) {
        resolve({
          isSuccess: false,
          isError: true,
          // TODO error
          error: null,
          user: null,
          accessToken: null
        })
      }
      service.onTransition((state) => {
        if (state.matches({ authentication: 'signedIn' })) {
          resolve({
            isSuccess: true,
            isError: false,
            error: null,
            user: state.context.user,
            accessToken: state.context.accessToken.value
          })
        }
        if (state.matches({ authentication: { signedOut: 'failed' } })) {
          resolve({
            isSuccess: false,
            isError: true,
            error: state.context.errors.authentication || null,
            user: null,
            accessToken: null
          })
        }
      })
    })

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
