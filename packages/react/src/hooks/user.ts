import jwt_decode from 'jwt-decode'
import { useMemo } from 'react'

import {
  ActionErrorState,
  ActionSuccessState,
  ChangeEmailHandlerResult,
  ChangeEmailOptions,
  changeEmailPromise,
  ChangeEmailState,
  ChangePasswordHandlerResult,
  CommonActionState,
  createChangeEmailMachine,
  createChangePasswordMachine,
  createEnableMfaMachine,
  createResetPasswordMachine,
  createSendVerificationEmailMachine,
  ErrorPayload,
  JWTClaims,
  ResetPasswordHandlerResult,
  ResetPasswordOptions,
  resetPasswordPromise,
  ResetPasswordState,
  SendVerificationEmailOptions
} from '@nhost/core'
import { useMachine, useSelector } from '@xstate/react'

import { useAccessToken, useAuthInterpreter, useNhostClient } from './common'

interface ChangeEmailHandler {
  (email: string, options?: ChangeEmailOptions): Promise<ChangeEmailHandlerResult>
  /** @deprecated */
  (email?: unknown, options?: ChangeEmailOptions): Promise<ChangeEmailHandlerResult>
}

interface ChangeEmailHookResult extends ChangeEmailState {
  /** Requests the email change. Returns a promise with the current context  */
  changeEmail: ChangeEmailHandler
}

/**
 * Change email hook
 *
 * @example
 * ```js
 * const {
 *   changeEmail,
 *   isLoading,
 *   needsEmailVerification,
 *   isError,
 *   error
 * } = useChangeEmail();
 * ```
 *
 * @example
 * ```jsx
 * import { useState } from 'react';
 * import { useChangeEmail } from '@nhost/react';
 *
 * const Component = () => {
 *   const [email, setEmail] = useState('');
 *   const { changeEmail, isLoading, needsEmailVerification, isError, error } = useChangeEmail();
 *
 *   return (
 *     <div>
 *       <input value={email} onChange={(event) => setEmail(event.target.value)} />
 *       <button onClick={() => changeEmail(email)}>Change email</button>
 *
 *       {needsEmailVerification && (
 *         <div>
 *           Please check your mailbox and follow the verification link to confirm your new email
 *         </div>
 *       )}
 *     </div>
 *   );
 * };
 * ```
 */
export function useChangeEmail(options?: ChangeEmailOptions): ChangeEmailHookResult

/**
 * @deprecated
 */
export function useChangeEmail(email?: string, options?: ChangeEmailOptions): ChangeEmailHookResult

export function useChangeEmail(a?: string | ChangeEmailOptions, b?: ChangeEmailOptions) {
  const stateEmail = typeof a === 'string' ? a : undefined
  const stateOptions = typeof a !== 'string' ? a : b
  const nhost = useNhostClient()
  const machine = useMemo(() => createChangeEmailMachine(nhost.auth.client), [nhost])

  const [, , service] = useMachine(machine)

  const isLoading = useSelector(service, (s) => s.matches('requesting'))
  const error = useSelector(service, (state) => state.context.error)
  const isError = useSelector(service, (state) => state.matches('idle.error'))
  const needsEmailVerification = useSelector(service, (state) => state.matches('idle.success'))

  const changeEmail: ChangeEmailHandler = async (
    valueEmail?: string | unknown,
    valueOptions = stateOptions
  ) =>
    changeEmailPromise(
      service,
      typeof valueEmail === 'string' ? valueEmail : (stateEmail as string),
      valueOptions
    )

  return { changeEmail, isLoading, needsEmailVerification, isError, error }
}

interface ChangePasswordHandler {
  (password: string): Promise<ChangePasswordHandlerResult>
  /** @deprecated */
  (password?: unknown): Promise<ChangePasswordHandlerResult>
}

interface ChangePasswordHookResult extends ActionErrorState, ActionSuccessState {
  /** Requests the password change. Returns a promise with the current context */
  changePassword: ChangePasswordHandler
}

interface ChangePasswordHook {
  (): ChangePasswordHookResult
  /** @deprecated */
  (email?: string): ChangePasswordHookResult
}

/**
 * Change password
 * 
 * @example
```js
const { changePassword, isLoading, isSuccess, isError, error } =
  useChangePassword();
```
* @example
```jsx
import { useState } from 'react';
import { useChangePassword } from '@nhost/react';

const Component = () => {
  const [password, setPassword] = useState('');
  const { changePassword, isLoading, isSuccess, isError, error } =
    useChangePassword();

  return (
    <div>
      <input
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />
      <button onClick={() => changePassword(password)}>Change password</button>
    </div>
  );
};
```
 * 
 */
export const useChangePassword: ChangePasswordHook = (statePassword?: string) => {
  const nhost = useNhostClient()
  const machine = useMemo(() => createChangePasswordMachine(nhost.auth.client), [nhost])
  const [current, send, service] = useMachine(machine)
  const isError = current.matches({ idle: 'error' })
  const isSuccess = current.matches({ idle: 'success' })
  const error = current.context.error
  const isLoading = current.matches('requesting')

  const changePassword: ChangePasswordHandler = (valuePassword?: string | unknown) =>
    new Promise<ChangePasswordHandlerResult>((resolve) => {
      send('REQUEST', {
        password: typeof valuePassword === 'string' ? valuePassword : statePassword
      })
      service.onTransition((state) => {
        if (state.matches({ idle: 'error' })) {
          resolve({ error: state.context.error, isError: true, isSuccess: false })
        } else if (state.matches({ idle: 'success' })) {
          resolve({ error: null, isError: false, isSuccess: true })
        }
      })
    })

  return { changePassword, isLoading, isSuccess, isError, error }
}

interface ResetPasswordHandler {
  (email: string, options?: ResetPasswordOptions): Promise<ResetPasswordHandlerResult>
  /** @deprecated */
  (email?: unknown, options?: ResetPasswordOptions): Promise<ResetPasswordHandlerResult>
}

interface ResetPasswordHookResult extends ResetPasswordState {
  /**
   * Sends an email with a temporary connection link. Returns a promise with the current context
   */
  resetPassword: ResetPasswordHandler
}

interface ResetPasswordHook {
  (options?: ResetPasswordOptions): ResetPasswordHookResult
  /** @deprecated */
  (email?: string, options?: ResetPasswordOptions): ResetPasswordHookResult
}

/**
 * If a user loses their password, we can resend them an email to authenticate so that they can change it to a new one
 * @example
```js
const { resetPassword, isLoading, isSent, isError, error } =
  useResetPassword();
```
 * 
 * @example
```jsx
import { useState } from 'react';
import { useResetPassword } from '@nhost/react';

const Component = () => {
  const [email, setEmail] = useState('');
  const { resetPassword, isLoading, isSent, isError, error } =
    useResetPassword();

  return (
    <div>
      <input value={email} onChange={(event) => setEmail(event.target.value)} />
      <button onClick={() => resetPassword(email)}>Send reset link</button>
    </div>
  );
};
```
 * 
 */
export const useResetPassword: ResetPasswordHook = (
  a?: string | ResetPasswordOptions,
  b?: ResetPasswordOptions
) => {
  const stateEmail = typeof a === 'string' ? a : undefined
  const stateOptions = typeof a !== 'string' ? a : b
  const nhost = useNhostClient()
  const machine = useMemo(() => createResetPasswordMachine(nhost.auth.client), [nhost])
  const [, , service] = useMachine(machine)

  const isLoading = useSelector(service, (s) => s.matches('requesting'))
  const error = useSelector(service, (state) => state.context.error)
  const isError = useSelector(service, (state) => state.matches('idle.error'))
  const isSent = useSelector(service, (state) => state.matches('idle.success'))

  const resetPassword: ResetPasswordHandler = (
    valueEmail?: string | unknown,
    valueOptions = stateOptions
  ) =>
    resetPasswordPromise(
      service,
      typeof valueEmail === 'string' ? valueEmail : (stateEmail as string),
      valueOptions
    )

  return { resetPassword, isLoading, isSent, isError, error }
}

/**
 * User data
 * @example
```js
const {
  id,
  email,
  displayName,
  avatarUrl,
  isAnonymous,
  locale,
  defaultRole,
  roles,
  metadata,
  createdAt,
} = useUserData();
```
 * 
 * @example Example of an authenticated user
```json
{
  "avatarUrl": "https://s.gravatar.com/avatar",
  "createdAt": "2022-04-11T16:33:14.780439+00:00",
  "defaultRole": "user",
  "displayName": "John Doe",
  "email": "john@nhost.io",
  "id": "05e054c7-a722-42e7-90a6-3f77a2f118c8",
  "isAnonymous": false,
  "locale": "en",
  "metadata": {
    "lastName": "Doe",
    "firstName": "John"
  },
  "roles": ["user", "me"]
}
```
 */
export const useUserData = () => {
  const service = useAuthInterpreter()
  return useSelector(
    service,
    (state) => state.context.user,
    (a, b) => (a && JSON.stringify(a)) === (b && JSON.stringify(b))
  )
}

/**
 * User avatar
 * @example
```jsx
import { useAvatarUrl } from '@nhost/react';

const Avatar = () => {
  const avatar = useAvatarUrl();

  return <img src={avatar} alt="Avatar" />;
};
```
 */
export const useUserAvatarUrl = () => {
  const service = useAuthInterpreter()
  return useSelector(
    service,
    (state) => state.context.user?.avatarUrl,
    (a, b) => a === b
  )
}

/**
 * @internal
 * @deprecated use {@link useUserAvatarUrl} instead */
export const useAvatarUrl = useUserAvatarUrl

/**
 * Gets the user's default role
 * @example
```jsx
import { useUserRoles, useDefaultRole } from '@nhost/react';

const Avatar = () => {
  const roles = useUserRoles();
  const defaultRole = useDefaultRole();

  return (
    <div>
      Your default role is {defaultRole}. You have the following roles:{' '}
      {roles.join(', ')}
    </div>
  );
};
```
 */
export const useUserDefaultRole = () => {
  const service = useAuthInterpreter()
  return useSelector(
    service,
    (state) => state.context.user?.defaultRole,
    (a, b) => a === b
  )
}

/**
 * @internal
 * @deprecated use {@link useUserDefaultRole} instead */
export const useDefaultRole = useUserDefaultRole

/**
 * Gets the user's display name
 * @example
```jsx
import { useDisplayName } from '@nhost/react';

const Avatar = () => {
  const displayName = useDisplayName();

  return <div>Hello, {displayName}</div>;
};
```
 */
export const useUserDisplayName = () => {
  const service = useAuthInterpreter()
  return useSelector(
    service,
    (state) => state.context.user?.displayName,
    (a, b) => a === b
  )
}

/**
 * @internal
 * @deprecated use {@link useUserDisplayName} instead */
export const useDisplayName = useUserDisplayName

/**
 * Gets the user's email
 * @example
```js
import { useEmail } from '@nhost/react';
const email = useEmail();
```
 */
export const useUserEmail = () => {
  const service = useAuthInterpreter()
  return useSelector(
    service,
    (state) => state.context.user?.email,
    (a, b) => a === b
  )
}

/**
 * @internal
 * @deprecated use {@link useUserEmail} instead */
export const useEmail = useUserEmail

/**
 * Gets the user id
 * @example
```js
import { useUserId } from '@nhost/react';
const id = useUserId();
```
 */
export const useUserId = () => {
  const service = useAuthInterpreter()
  return useSelector(
    service,
    (state) => state.context.user?.id,
    (a, b) => a === b
  )
}

/**
 * Returns whether the user is anonymous ot not
 * @example
```js
import { useIsAnonymous } from '@nhost/react';
const isAnonymous = useIsAnonymous();
```
 */
export const useUserIsAnonymous = () => {
  const service = useAuthInterpreter()
  return useSelector(
    service,
    (state) => state.context.user?.isAnonymous,
    (a, b) => a === b
  )
}

/**
 * @internal
 * @deprecated use {@link useUserIsAnonymous} instead */
export const useIsAnonymous = useUserIsAnonymous

/**
 * Gets the user locale
 * @example
```js
import { useUserLocale } from '@nhost/react';
const locale = useUserLocale();
```
 */
export const useUserLocale = () => {
  const service = useAuthInterpreter()
  return useSelector(
    service,
    (state) => state.context.user?.locale,
    (a, b) => a === b
  )
}

/**
 * Hook to get the current user's roles.
 *
 * @example
 * ```ts
 * const roles = useUserRoles()
 * ```
 *
 * @returns Roles of the current user
 */
export const useUserRoles = () => {
  const service = useAuthInterpreter()
  return useSelector(
    service,
    (state) => state.context.user?.roles || [],
    (a, b) => a.every((i) => b.includes(i) && b.every((i) => a.includes(i)))
  )
}

// TODO code this hook in Vue, and make it a promise
type SendVerificationEmailHandlerResult = Omit<SendVerificationEmailState, 'isLoading'>
interface SendVerificationEmailHandler {
  (
    email: string,
    options?: SendVerificationEmailOptions
  ): Promise<SendVerificationEmailHandlerResult>
  /** @deprecated */
  (
    email?: unknown,
    options?: SendVerificationEmailOptions
  ): Promise<SendVerificationEmailHandlerResult>
}

interface SendVerificationEmailState extends CommonActionState {
  isSent: boolean
}

interface SendVerificationEmailHookResult extends SendVerificationEmailState {
  /** Resend the verification email. Returns a promise with the current context */
  sendEmail: SendVerificationEmailHandler
}

interface SendVerificationEmailHook {
  (options?: SendVerificationEmailOptions): SendVerificationEmailHookResult
  /** @deprecated */
  (email?: string, options?: SendVerificationEmailOptions): SendVerificationEmailHookResult
}

/**
 * Send email verification
 * @example
```js
const { sendEmail, isLoading, isSent, isError, error } =
  useSendVerificationEmail();
```
 * 
 * @example
```jsx
import { useState } from 'react';
import { useSendVerificationEmail } from '@nhost/react';

const Component = () => {
  const [email, setEmail] = useState('');
  const { sendEmail, isLoading, isSent, isError, error } =
    useSendVerificationEmail();

  return (
    <div>
      <input value={email} onChange={(event) => setEmail(event.target.value)} />
      <button onClick={() => sendEmail(email)}>Send email verification</button>
      {isSent && (
        <div>
          Please check your mailbox and follow the verification link to confirm
          your email
        </div>
      )}
    </div>
  );
};
```
 */
export const useSendVerificationEmail: SendVerificationEmailHook = (
  a?: string | SendVerificationEmailOptions,
  b?: SendVerificationEmailOptions
) => {
  const stateEmail = typeof a === 'string' ? a : undefined
  const stateOptions = typeof a !== 'string' ? a : b
  const nhost = useNhostClient()
  const machine = useMemo(() => createSendVerificationEmailMachine(nhost.auth.client), [nhost])
  const [current, send, service] = useMachine(machine)
  const isError = current.matches({ idle: 'error' })
  const isSent = current.matches({ idle: 'success' })
  const error = current.context.error
  const isLoading = current.matches('requesting')

  const sendEmail: SendVerificationEmailHandler = (
    valueEmail?: string | unknown,
    valueOptions = stateOptions
  ) =>
    new Promise<SendVerificationEmailHandlerResult>((resolve) => {
      send('REQUEST', {
        email: typeof valueEmail === 'string' ? valueEmail : stateEmail,
        options: valueOptions
      })
      service.onTransition((state) => {
        if (state.matches({ idle: 'error' })) {
          resolve({ error: state.context.error, isError: true, isSent: false })
        } else if (state.matches({ idle: 'success' })) {
          resolve({ error: null, isError: false, isSent: true })
        }
      })
    })
  return { sendEmail, isLoading, isSent, isError, error }
}

interface ActivateMfaState {
  isActivating: boolean
  isActivated: boolean
  isError: boolean
  error: ErrorPayload | null
}
interface GenerateQrCodeState {
  qrCodeDataUrl: string
  isGenerating: boolean
  isGenerated: boolean
  isError: boolean
  error: ErrorPayload | null
}
type ActivateMfaHandlerResult = Omit<ActivateMfaState, 'isActivating'>
type ActivateMfaHandler = (code: string) => Promise<ActivateMfaHandlerResult>

type GenerateQrCodeHandlerResult = Omit<GenerateQrCodeState, 'isGenerating'>
type GenerateQrCodeHandler = () => Promise<GenerateQrCodeHandlerResult>

interface ConfigMfaState extends ActivateMfaState, GenerateQrCodeState {
  generateQrCode: GenerateQrCodeHandler
  activateMfa: ActivateMfaHandler
}

type ConfigMfaHook = () => ConfigMfaState

// TODO documentation when available in Nhost Cloud - see changelog
export const useConfigMfa: ConfigMfaHook = () => {
  const nhost = useNhostClient()

  const machine = useMemo(() => createEnableMfaMachine(nhost.auth.client), [nhost])
  const [current, send, service] = useMachine(machine)

  const isError = useMemo(
    () => current.matches({ idle: 'error' }) || current.matches({ generated: { idle: 'error' } }),
    [current]
  )
  const isGenerating = current.matches('generating')
  const isGenerated = current.matches('generated')
  const isActivating = current.matches({ generated: 'activating' })
  const isActivated = current.matches({ generated: 'activated' })
  const error = current.context.error
  const qrCodeDataUrl = current.context.imageUrl || ''

  const generateQrCode: GenerateQrCodeHandler = () =>
    new Promise<GenerateQrCodeHandlerResult>((resolve) => {
      send('GENERATE')
      service.onTransition((state) => {
        if (state.matches('generated')) {
          resolve({
            error: null,
            isError: false,
            isGenerated: true,
            qrCodeDataUrl: state.context.imageUrl || ''
          })
        } else if (state.matches({ idle: 'error' })) {
          resolve({
            error: state.context.error || null,
            isError: true,
            isGenerated: false,
            qrCodeDataUrl: ''
          })
        }
      })
    })
  const activateMfa: ActivateMfaHandler = (code: string) =>
    new Promise<ActivateMfaHandlerResult>((resolve) => {
      send('ACTIVATE', {
        activeMfaType: 'totp',
        code
      })
      service.onTransition((state) => {
        if (state.matches({ generated: 'activated' })) {
          resolve({ error: null, isActivated: true, isError: false })
        } else if (state.matches({ generated: { idle: 'error' } })) {
          resolve({ error: state.context.error, isActivated: false, isError: true })
        }
      })
    })
  return {
    generateQrCode,
    isGenerating,
    qrCodeDataUrl,
    isGenerated,
    activateMfa,
    isActivating,
    isActivated,
    isError,
    error
  }
}

/**
 * Decode the current decoded access token (JWT), or return `null` if the user is not authenticated (no token)
 * @see {@link https://hasura.io/docs/latest/graphql/core/auth/authentication/jwt/|Hasura documentation}
 * @example
 * ```ts
 * import { useDecodedAccessToken } from '@nhost/react'
 * const Component = () => {
 *    const decodedToken = useDecodedAccessToken()
 *    return <div>Decoded access token: {JSON.stringify(decodedToken)}</div>
 * }
 * ```
 */
export const useDecodedAccessToken = () => {
  const jwt = useAccessToken()
  return jwt ? jwt_decode<JWTClaims>(jwt) : null
}

/**
 * Decode the Hasura claims from the current access token (JWT) located in the `https://hasura.io/jwt/claims` namespace, or return `null` if the user is not authenticated (no token)
 * @see {@link https://hasura.io/docs/latest/graphql/core/auth/authentication/jwt/|Hasura documentation}
 * @example
 * ```ts
 * import { useHasuraClaims } from '@nhost/react'
 * const Component = () => {
 *    const hasuraClaims = useHasuraClaims()
 *    return <div>JWT claims in the `https://hasura.io/jwt/claims` namespace: {JSON.stringify(hasuraClaims)}</div>
 * }
 * ```
 */
export const useHasuraClaims = () => {
  const claims = useDecodedAccessToken()
  return claims?.['https://hasura.io/jwt/claims'] || null
}

/**
 * Get the value of a given Hasura claim in the current access token (JWT). Returns null if the user is not authenticated, or if the claim is not in the token.
 * Return `null` if the user is not authenticated (no token)
 * @param name name of the variable. Automatically adds the `x-hasura-` prefix if it is missing
 * @see {@link https://hasura.io/docs/latest/graphql/core/auth/authentication/jwt/|Hasura documentation}
 * @example
 * ```ts
 * import { useHasuraClaim } from '@nhost/react'
 * const Component = () => {
 *    const claim = useHasuraClaim('user-id')
 *    return <div>User id extracted from the JWT access token: {claim}</div>
 * }
 * ```
 */
export const useHasuraClaim = (name: string) => {
  const hasuraClaims = useHasuraClaims()
  return hasuraClaims?.[name.startsWith('x-hasura-') ? name : `x-hasura-${name}`] || null
}
