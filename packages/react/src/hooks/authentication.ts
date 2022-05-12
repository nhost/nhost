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
/**
 * Email and Password Sign-In
 * @example
```js
const {
  signInEmailPassword,
  isLoading,
  needsEmailVerification,
  needsMfaOtp,
  sendMfaOtp,
  isSuccess,
  isError,
  error,
  user,
} = useSignInEmailPassword();
```
  * @example
```jsx
import { useState } from 'react';
import { useSignInEmailPassword } from '@nhost/react';

const Component = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const {
    signInEmailPassword,
    isLoading,
    isSuccess,
    needsEmailVerification,
    isError,
    error,
  } = useSignInEmailPassword();

  return (
    <div>
      <input
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="Email"
      />
      <input
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        placeholder="Password"
      />
      <button onClick={() => signInEmailPassword(email, password)}>
        Register
      </button>
      {isSuccess && <div>Authentication suceeded</div>}
      {needsEmailVerification && (
        <div>
          You must verify your email to sign in. Check your mailbox and follow
          the instructions to verify your email.
        </div>
      )}
    </div>
  );
};
```
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
 * Passwordless email authentication hook
 *
 * @example
 * ```js
 * const { signInEmailPasswordless, isLoading, isSuccess, isError, error } =
 *   useSignInEmailPasswordless();
 * ```
 *
 * @example
 * ```jsx
 * import { useState } from 'react';
 * import { useSignInEmailPasswordless } from '@nhost/react';
 *
 * const Component = () => {
 *   const [email, setEmail] = useState('');
 *   const { signInEmailPasswordless, isLoading, isSuccess, isError, error } =
 *     useSignInEmailPasswordless();
 *
 *   return (
 *     <div>
 *       <input
 *         value={email}
 *         onChange={(event) => setEmail(event.target.value)}
 *         placeholder="Email"
 *       />
 *
 *       <button onClick={() => signInEmailPasswordless(email)}>
 *         Authenticate
 *       </button>
 *
 *       {isSuccess && (
 *         <div>
 *           An email has been sent to {email}. Please check your mailbox and click on the
 *           authentication link.
 *         </div>
 *       )}
 *     </div>
 *   );
 * };
 * ```
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
 * Hook that returns OAuth provider URLs
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
 *       <a href={facebook}>Authenticate with Facebook</a>
 *       <a href={github}>Authenticate with GitHub</a>
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
