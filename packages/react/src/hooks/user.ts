import jwt_decode from 'jwt-decode'
import { useMemo, useState } from 'react'

import {
  ChangeEmailOptions,
  createChangeEmailMachine,
  createChangePasswordMachine,
  createEnableMfaMachine,
  createResetPasswordMachine,
  createSendVerificationEmailMachine,
  ErrorPayload,
  JWTClaims,
  ResetPasswordOptions,
  SendVerificationEmailOptions
} from '@nhost/core'
import { useMachine, useSelector } from '@xstate/react'

import {
  ActionHookErrorState,
  ActionHookSuccessState,
  CommonActionHookState,
  useAccessToken,
  useAuthInterpreter,
  useNhostClient
} from './common'
interface ChangeEmailHookState extends CommonActionHookState {
  needsEmailVerification: boolean
}

type ChangeEmailHandlerResult = Omit<ChangeEmailHookState, 'isLoading'>
interface ChangeEmailHandler {
  (email: string, options?: ChangeEmailOptions): Promise<ChangeEmailHandlerResult>
  /** @deprecated */
  (email?: unknown, options?: ChangeEmailOptions): Promise<ChangeEmailHandlerResult>
}

interface ChangeEmailHookResult extends ChangeEmailHookState {
  /** Requests the email change. Returns a promise with the current context  */
  changeEmail: ChangeEmailHandler
}

/**
 * Use the hook `useChangeEmail` to change email for the current user.
 *
 * @example
 * ```tsx
 * const { changeEmail, isLoading, needsEmailVerification, isError, error } = useChangeEmail();
 *
 * console.log({ isLoading, needsEmailVerification, isError, error });
 *
 * const handleFormSubmit = async (e) => {
 *   e.preventDefault();
 *
 *   await changeEmail({
 *     email: 'new@example.com',
 *   })
 * }
 * ```
 *
 * @docs https://docs.nhost.io/reference/react/use-change-email
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
  const [, send, service] = useMachine(machine)
  const [isError, setIsError] = useState(false)
  const [needsEmailVerification, setNeedsEmailVerification] = useState(false)
  const [error, setError] = useState<ErrorPayload | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const changeEmail: ChangeEmailHandler = async (
    valueEmail?: string | unknown,
    valueOptions = stateOptions
  ) =>
    new Promise<ChangeEmailHandlerResult>((resolve) => {
      send({
        type: 'REQUEST',
        email: typeof valueEmail === 'string' ? valueEmail : stateEmail,
        options: valueOptions
      })
      service.onTransition((state) => {
        if (state.matches({ idle: 'error' })) {
          const error = state.context.error
          setIsError(true)
          setError(error)
          setIsLoading(false)
          resolve({ isError: true, error, needsEmailVerification })
        } else if (state.matches('requesting')) {
          setIsLoading(true)
        } else if (state.matches({ idle: 'success' })) {
          setIsError(false)
          setError(null)
          setIsLoading(false)
          setNeedsEmailVerification(true)
          resolve({ isError: false, error: null, needsEmailVerification: true })
        }
      })
    })

  return { changeEmail, isLoading, needsEmailVerification, isError, error }
}

interface ChangePasswordHandlerResult extends ActionHookErrorState, ActionHookSuccessState {}

interface ChangePasswordHandler {
  (password: string): Promise<ChangePasswordHandlerResult>
  /** @deprecated */
  (password?: unknown): Promise<ChangePasswordHandlerResult>
}

interface ChangePasswordHookResult extends ActionHookErrorState, ActionHookSuccessState {
  /** Requests the password change. Returns a promise with the current context */
  changePassword: ChangePasswordHandler
}

interface ChangePasswordHook {
  (): ChangePasswordHookResult
  /** @deprecated */
  (email?: string): ChangePasswordHookResult
}

/**
 * Use the hook `useChangePassword` to change password for the current user.
 *
 * @example
 * ```tsx
 * const { changePassword, isLoading, isSuccess, isError, error } = useChangePassword();
 *
 * console.log({ isLoading, isSuccess, isError, error });
 *
 * const handleFormSubmit = async (e) => {
 *   e.preventDefault();
 *
 *   await changePassword('my-new-password')
 * }
 * ```
 *
 * @docs https://docs.nhost.io/reference/react/use-change-password
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
      send({
        type: 'REQUEST',
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

type ResetPasswordHandlerResult = Omit<ResetPasswordHookState, 'isLoading'>
interface ResetPasswordHandler {
  (email: string, options?: ResetPasswordOptions): Promise<ResetPasswordHandlerResult>
  /** @deprecated */
  (email?: unknown, options?: ResetPasswordOptions): Promise<ResetPasswordHandlerResult>
}

interface ResetPasswordHookState extends CommonActionHookState {
  isSent: boolean
}

interface ResetPasswordHookResult extends ResetPasswordHookState {
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
 * Use the hook `useResetPassword` to reset the password for a user. This will send a reset password link in an email to the user. When the user clicks on the reset-password link the user is automatically signed in and can change their password using the hook `useChangePassword`.
 *
 * @example
 * ```tsx
 * const { resetPassword, isLoading, isSent, isError, error } = useResetPassword();
 *
 * console.log({ isLoading, isSent, isError, error });
 *
 * const handleFormSubmit = async (e) => {
 *   e.preventDefault();
 *
 *   await resetPassword('joe@example.com', {
 *     redirectTo: 'http://localhost:3000/settings/change-password'
 *   })
 * }
 * ```
 *
 * @docs https://docs.nhost.io/reference/react/use-reset-password
 */
export const useResetPassword: ResetPasswordHook = (
  a?: string | ResetPasswordOptions,
  b?: ResetPasswordOptions
) => {
  const stateEmail = typeof a === 'string' ? a : undefined
  const stateOptions = typeof a !== 'string' ? a : b
  const nhost = useNhostClient()
  const machine = useMemo(() => createResetPasswordMachine(nhost.auth.client), [nhost])
  const [current, send, service] = useMachine(machine)
  const isError = current.matches({ idle: 'error' })
  const isSent = current.matches({ idle: 'success' })
  const error = current.context.error
  const isLoading = current.matches('requesting')

  const resetPassword: ResetPasswordHandler = (
    valueEmail?: string | unknown,
    valueOptions = stateOptions
  ) =>
    new Promise<ResetPasswordHandlerResult>((resolve) => {
      send({
        type: 'REQUEST',
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
  return { resetPassword, isLoading, isSent, isError, error }
}

/**
 * Use the hook `useUserData` to get the user data of the current user.
 *
 * @example
 * ```tsx
 * const userData = useUserData();
 * ```
 * 
   * @example Example of user data
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
 *
 * @docs https://docs.nhost.io/reference/react/use-user-data
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
 * Use the hook `useUserAvatarUrl` to get the avatar URL of the current user.
 *
 * @example
 * ```tsx
 * const userAvatarUrl = useUserAvatarUrl();
 * ```
 *
 * @docs https://docs.nhost.io/reference/react/use-user-avatar-url
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
 * Use the hook `useUserDefaultRole` to get the default role of the current user.
 *
 * @example
 * ```tsx
 * const userDefaultRole = useUserDefaultRole();
 * ```
 *
 * @docs https://docs.nhost.io/reference/react/use-user-default-role
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
 * Use the hook `useUserDisplayName` to get the display name of the current user.
 *
 * @example
 * ```tsx
 * const userDisplayName = useUserDisplayName();
 * ```
 *
 * @docs https://docs.nhost.io/reference/react/use-user-display-name
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
 * Use the hook `useUserEmail` to get the email of the current user.
 *
 * @example
 * ```tsx
 * const userEmail = useUserEmail();
 * ```
 *
 * @docs https://docs.nhost.io/reference/react/use-user-email
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
 * Use the hook `useUserId` to get the id of the current user.
 *
 * @example
 * ```tsx
 * const userId = useUserId();
 * ```
 *
 * @docs https://docs.nhost.io/reference/react/use-user-id
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
 * Use the hook `useUserIsAnonymous` to see if the user is anonymous or not.
 *
 * @example
 * ```tsx
 * const userIsAnonymous = useUserIsAnonymous();
 * ```
 *
 * @docs https://docs.nhost.io/reference/react/use-user-is-anonymous
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
 * Use the hook `useUserLocale` to get the locale of the current user.
 *
 * @example
 * ```tsx
 * const userLocale = useUserLocale();
 * ```
 *
 * @docs https://docs.nhost.io/reference/react/use-user-locale
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
 * Use the hook `useUserRoles` to get all allowed roles of the current user.
 *
 * @example
 * ```tsx
 * const userRoles = useUserRoles();
 * ```
 *
 * @docs https://docs.nhost.io/reference/react/use-user-roles
 */
export const useUserRoles = () => {
  const service = useAuthInterpreter()
  return useSelector(
    service,
    (state) => state.context.user?.roles || [],
    (a, b) => a.every((i) => b.includes(i) && b.every((i) => a.includes(i)))
  )
}

type SendVerificationEmailHandlerResult = Omit<SendVerificationEmailHookState, 'isLoading'>
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

interface SendVerificationEmailHookState extends CommonActionHookState {
  isSent: boolean
}

interface SendVerificationEmailHookResult extends SendVerificationEmailHookState {
  /** Resend the verification email. Returns a promise with the current context */
  sendEmail: SendVerificationEmailHandler
}

interface SendVerificationEmailHook {
  (options?: SendVerificationEmailOptions): SendVerificationEmailHookResult
  /** @deprecated */
  (email?: string, options?: SendVerificationEmailOptions): SendVerificationEmailHookResult
}

/**
 * Use the hook `useSendVerificationEmail` to send a verification email. The verification email is sent to the user's email address and inclides a link to verify the email address.
 *
 * @example
 * ```tsx
 * const { sendEmail, isLoading, isSent, isError, error } =
  useSendVerificationEmail();
 *
 * console.log({ isLoading, isSent, isError, error });
 *
 * const handleFormSubmit = async (e) => {
 *   e.preventDefault();
 *
 *   await sendEmail({
 *     email: 'joe@example.com',
 *   })
 * }
 * ```
 *
 * @docs https://docs.nhost.io/reference/react/use-send-verification-email
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
      send({
        type: 'REQUEST',
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

interface ActivateMfaHookState {
  isActivating: boolean
  isActivated: boolean
  isError: boolean
  error: ErrorPayload | null
}
interface GenerateQrCodeHookState {
  qrCodeDataUrl: string
  isGenerating: boolean
  isGenerated: boolean
  isError: boolean
  error: ErrorPayload | null
}
type ActivateMfaHandlerResult = Omit<ActivateMfaHookState, 'isActivating'>
type ActivateMfaHandler = (code: string) => Promise<ActivateMfaHandlerResult>

type GenerateQrCodeHandlerResult = Omit<GenerateQrCodeHookState, 'isGenerating'>
type GenerateQrCodeHandler = () => Promise<GenerateQrCodeHandlerResult>

interface ConfigMfaHookState extends ActivateMfaHookState, GenerateQrCodeHookState {
  generateQrCode: GenerateQrCodeHandler
  activateMfa: ActivateMfaHandler
}

type ConfigMfaHook = () => ConfigMfaHookState

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
      send({
        type: 'ACTIVATE',
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
 * Use the hook `useDecodedAccessToken` to get the decoded access token of the current user.
 *
 * @example
 * ```tsx
 * const decodedAccessToken = useDecodedAccessToken()
 * ```
 *
 * @docs https://docs.nhost.io/reference/react/use-decoded-access-token
 */
export const useDecodedAccessToken = () => {
  const jwt = useAccessToken()
  return jwt ? jwt_decode<JWTClaims>(jwt) : null
}

/**
 * Use the hook `useHasuraClaims` to get the Hasura claims of the current user.
 *
 * @example
 * ```tsx
 * const hasuraClaims = useHasuraClaims()
 * ```
 *
 * @docs https://docs.nhost.io/reference/react/use-hasura-claims
 */
export const useHasuraClaims = () => {
  const claims = useDecodedAccessToken()
  return claims?.['https://hasura.io/jwt/claims'] || null
}

/**
 * Use the hook `useHasruaClaim` to get the value of a specific Hasura claim of the current user.
 *
 * @example
 * ```tsx
 * // if `x-hasura-company-id` exists as a custom claim
 * const companyId = useHasuraClaim('company-id')
 * ```
 *
 * @docs https://docs.nhost.io/reference/react/use-hasura-claim
 */
export const useHasuraClaim = (name: string) => {
  const hasuraClaims = useHasuraClaims()
  return hasuraClaims?.[name.startsWith('x-hasura-') ? name : `x-hasura-${name}`] || null
}
