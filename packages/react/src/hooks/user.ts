import jwt_decode from 'jwt-decode'
import { useCallback, useMemo } from 'react'

import {
  ActionErrorState,
  ActionSuccessState,
  ActivateMfaHandlerResult,
  activateMfaPromise,
  ActivateMfaState,
  ChangeEmailHandlerResult,
  ChangeEmailOptions,
  changeEmailPromise,
  ChangeEmailState,
  ChangePasswordHandlerResult,
  changePasswordPromise,
  createChangeEmailMachine,
  createChangePasswordMachine,
  createEnableMfaMachine,
  createResetPasswordMachine,
  createSendVerificationEmailMachine,
  GenerateQrCodeHandlerResult,
  generateQrCodePromise,
  GenerateQrCodeState,
  JWTClaims,
  ResetPasswordHandlerResult,
  ResetPasswordOptions,
  resetPasswordPromise,
  ResetPasswordState,
  SendVerificationEmailHandlerResult,
  SendVerificationEmailOptions,
  sendVerificationEmailPromise,
  SendVerificationEmailState
} from '@nhost/core'
import { useInterpret, useSelector } from '@xstate/react'

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
 * Use the hook `useChangeEmail` to change email for the user.
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
  const stateEmail = useMemo(() => (typeof a === 'string' ? a : undefined), [a])
  const stateOptions = useMemo(() => (typeof a !== 'string' ? a : b), [a, b])
  const nhost = useNhostClient()
  const machine = useMemo(() => createChangeEmailMachine(nhost.auth.client), [nhost])

  const service = useInterpret(machine)

  const isLoading = useSelector(service, (s) => s.matches('requesting'))
  const error = useSelector(service, (state) => state.context.error)
  const isError = useSelector(service, (state) => state.matches('idle.error'))
  const needsEmailVerification = useSelector(service, (state) => state.matches('idle.success'))

  const changeEmail: ChangeEmailHandler = useCallback(
    async (valueEmail?: string | unknown, valueOptions = stateOptions) =>
      changeEmailPromise(
        service,
        typeof valueEmail === 'string' ? valueEmail : (stateEmail as string),
        valueOptions
      ),
    [service, stateEmail, stateOptions]
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
 * Use the hook `useChangePassword` to change password for the user.
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
  const service = useInterpret(machine)

  const isError = useSelector(service, (state) => state.matches({ idle: 'error' }))
  const isSuccess = useSelector(service, (state) => state.matches({ idle: 'success' }))
  const error = useSelector(service, (state) => state.context.error)
  const isLoading = useSelector(service, (state) => state.matches('requesting'))

  const changePassword: ChangePasswordHandler = (valuePassword?: string | unknown) =>
    changePasswordPromise(
      service,
      typeof valuePassword === 'string' ? valuePassword : (statePassword as string)
    )

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
  const service = useInterpret(machine)

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
 * Use the hook `useUserData` to get the user data of the user.
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
 * Use the hook `useUserAvatarUrl` to get the avatar URL of the user.
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
 * Use the hook `useUserDefaultRole` to get the default role of the user.
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
 * Use the hook `useUserDisplayName` to get the display name of the user.
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
 * Use the hook `useUserEmail` to get the email of the user.
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
 * Use the hook `useUserId` to get the id of the user.
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
 * Use the hook `useUserLocale` to get the locale of the user.
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
 * Use the hook `useUserRoles` to get all allowed roles of the user.
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
  const service = useInterpret(machine)
  const isError = useSelector(service, (state) => state.matches({ idle: 'error' }))
  const isSent = useSelector(service, (state) => state.matches({ idle: 'success' }))
  const error = useSelector(service, (state) => state.context.error)
  const isLoading = useSelector(service, (state) => state.matches('requesting'))

  const sendEmail: SendVerificationEmailHandler = (
    valueEmail?: string | unknown,
    valueOptions = stateOptions
  ) =>
    sendVerificationEmailPromise(
      service,
      typeof valueEmail === 'string' ? valueEmail : (stateEmail as string),
      valueOptions
    )

  return { sendEmail, isLoading, isSent, isError, error }
}

interface ConfigMfaState extends ActivateMfaState, GenerateQrCodeState {
  generateQrCode: () => Promise<GenerateQrCodeHandlerResult>
  activateMfa: (code: string) => Promise<ActivateMfaHandlerResult>
}

// TODO documentation when available in Nhost Cloud - see changelog
export const useConfigMfa = (): ConfigMfaState => {
  const nhost = useNhostClient()

  const machine = useMemo(() => createEnableMfaMachine(nhost.auth.client), [nhost])
  const service = useInterpret(machine)

  const isError = useSelector(
    service,
    (state) => state.matches({ idle: 'error' }) || state.matches({ generated: { idle: 'error' } })
  )
  const isGenerating = useSelector(service, (state) => state.matches('generating'))
  const isGenerated = useSelector(service, (state) => state.matches('generated'))
  const isActivating = useSelector(service, (state) => state.matches({ generated: 'activating' }))
  const isActivated = useSelector(service, (state) => state.matches({ generated: 'activated' }))
  const error = useSelector(service, (state) => state.context.error)
  const qrCodeDataUrl = useSelector(service, (state) => state.context.imageUrl || '')

  const generateQrCode = () => generateQrCodePromise(service)

  const activateMfa = (code: string) => activateMfaPromise(service, code)

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
 * Use the hook `useDecodedAccessToken` to get the decoded access token of the user.
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
 * Use the hook `useHasuraClaims` to get the Hasura claims of the user.
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
 * Use the hook `useHasuraClaim` to get the value of a specific Hasura claim of the user.
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
