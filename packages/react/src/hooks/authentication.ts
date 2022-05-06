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
  ActionHookErrorState,
  ActionHookSuccessState,
  DefaultActionHookState,
  useAuthenticated,
  useAuthInterpreter
} from './common'

interface SignInEmailPasswordHookState extends DefaultActionHookState {
  needsMfaOtp: boolean
  needsEmailVerification: boolean
  user: User | null
  accessToken: string | null
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

interface SignInEmailPasswordlessHandlerResult
  extends ActionHookErrorState,
    ActionHookSuccessState {}
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
  const signInAnonymous = () => {
    service.send('SIGNIN_ANONYMOUS')
  }

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
