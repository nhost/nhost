import { useMemo } from 'react'

import {
  ChangeEmailOptions,
  createChangeEmailMachine,
  createChangePasswordMachine,
  createEnableMfaMachine,
  createResetPasswordMachine,
  createSendVerificationEmailMachine,
  ResetPasswordOptions,
  SendVerificationEmailOptions
} from '@nhost/core'
import { useMachine, useSelector } from '@xstate/react'

import { ActionHookState, useAuthInterpreter, useNhostClient } from './common'

type ChangeEmailHookHandler = {
  (email: string, options?: ChangeEmailOptions): void
  /** @deprecated */
  (email?: unknown, options?: ChangeEmailOptions): void
}

type ChangeEmailHookState = ActionHookState<'needsEmailVerification'>

type ChangeEmailHookResult = {
  changeEmail: ChangeEmailHookHandler
} & ChangeEmailHookState

type ChangeEmailHook = {
  (options?: ChangeEmailOptions): ChangeEmailHookResult
  /** @deprecated */
  (email?: string, options?: ChangeEmailOptions): ChangeEmailHookResult
}

export const useChangeEmail: ChangeEmailHook = (
  a?: string | ChangeEmailOptions,
  b?: ChangeEmailOptions
) => {
  const stateEmail = typeof a === 'string' ? a : undefined
  const stateOptions = typeof a !== 'string' ? a : b
  const nhost = useNhostClient()
  const machine = useMemo(() => createChangeEmailMachine(nhost.auth.client), [nhost])
  const [current, send] = useMachine(machine)

  const isError = current.matches({ idle: 'error' })
  const needsEmailVerification = current.matches({ idle: 'success' })
  const error = current.context.error
  const isLoading = current.matches('requesting')

  const changeEmail: ChangeEmailHookHandler = (
    valueEmail?: string | unknown,
    valueOptions = stateOptions
  ) => {
    send({
      type: 'REQUEST',
      email: typeof valueEmail === 'string' ? valueEmail : stateEmail,
      options: valueOptions
    })
  }

  return { changeEmail, isLoading, needsEmailVerification, isError, error }
}

type ChangePasswordHookHandler = {
  (password: string): void
  /** @deprecated */
  (password?: unknown): void
}

type ChangePasswordHookResult = {
  changePassword: ChangePasswordHookHandler
} & ActionHookState

type ChangePasswordHook = {
  (): ChangePasswordHookResult
  /** @deprecated */
  (email?: string): ChangePasswordHookResult
}

export const useChangePassword: ChangePasswordHook = (statePassword?: string) => {
  const nhost = useNhostClient()
  const machine = useMemo(() => createChangePasswordMachine(nhost.auth.client), [nhost])
  const [current, send] = useMachine(machine)
  const isError = current.matches({ idle: 'error' })
  const isSuccess = current.matches({ idle: 'success' })
  const error = current.context.error
  const isLoading = current.matches('requesting')

  const changePassword: ChangePasswordHookHandler = (valuePassword?: string | unknown) => {
    send({
      type: 'REQUEST',
      password: typeof valuePassword === 'string' ? valuePassword : statePassword
    })
  }

  return { changePassword, isLoading, isSuccess, isError, error }
}

type ResetPasswordHookHandler = {
  (email: string, options?: ResetPasswordOptions): void
  /** @deprecated */
  (email?: unknown, options?: ResetPasswordOptions): void
}

type ResetPasswordHookState = ActionHookState<'isSent'>

type ResetPasswordHookResult = {
  resetPassword: ResetPasswordHookHandler
} & ResetPasswordHookState

type ResetPasswordHook = {
  (options?: ResetPasswordOptions): ResetPasswordHookResult
  /** @deprecated */
  (email?: string, options?: ResetPasswordOptions): ResetPasswordHookResult
}

export const useResetPassword: ResetPasswordHook = (
  a?: string | ResetPasswordOptions,
  b?: ResetPasswordOptions
) => {
  const stateEmail = typeof a === 'string' ? a : undefined
  const stateOptions = typeof a !== 'string' ? a : b
  const nhost = useNhostClient()
  const machine = useMemo(() => createResetPasswordMachine(nhost.auth.client), [nhost])
  const [current, send] = useMachine(machine)
  const isError = current.matches({ idle: 'error' })
  const isSent = current.matches({ idle: 'success' })
  const error = current.context.error
  const isLoading = current.matches('requesting')

  const resetPassword: ResetPasswordHookHandler = (
    valueEmail?: string | unknown,
    valueOptions = stateOptions
  ) => {
    send({
      type: 'REQUEST',
      email: typeof valueEmail === 'string' ? valueEmail : stateEmail,
      options: valueOptions
    })
  }
  return { resetPassword, isLoading, isSent, isError, error }
}

export const useUserData = () => {
  const service = useAuthInterpreter()
  return useSelector(
    service,
    (state) => state.context.user,
    (a, b) => JSON.stringify(a) === JSON.stringify(b)
  )
}

export const useAvatarUrl = () => {
  const service = useAuthInterpreter()
  return useSelector(
    service,
    (state) => state.context.user?.avatarUrl,
    (a, b) => a === b
  )
}

export const useDefaultRole = () => {
  const service = useAuthInterpreter()
  return useSelector(
    service,
    (state) => state.context.user?.defaultRole,
    (a, b) => a === b
  )
}

export const useDisplayName = () => {
  const service = useAuthInterpreter()
  return useSelector(
    service,
    (state) => state.context.user?.displayName,
    (a, b) => a === b
  )
}

export const useEmail = () => {
  const service = useAuthInterpreter()
  return useSelector(
    service,
    (state) => state.context.user?.email,
    (a, b) => a === b
  )
}

export const useUserId = () => {
  const service = useAuthInterpreter()
  return useSelector(
    service,
    (state) => state.context.user?.id,
    (a, b) => a === b
  )
}

export const useIsAnonymous = () => {
  const service = useAuthInterpreter()
  return useSelector(
    service,
    (state) => state.context.user?.isAnonymous,
    (a, b) => a === b
  )
}

export const useUserLocale = () => {
  const service = useAuthInterpreter()
  return useSelector(
    service,
    (state) => state.context.user?.locale,
    (a, b) => a === b
  )
}

export const useUserRoles = () => {
  const service = useAuthInterpreter()
  return useSelector(
    service,
    (state) => state.context.user?.roles || [],
    (a, b) => a.every((i) => b.includes(i) && b.every((i) => a.includes(i)))
  )
}

type SendVerificationEmailHookHandler = {
  (email: string, options?: SendVerificationEmailOptions): void
  /** @deprecated */
  (email?: unknown, options?: SendVerificationEmailOptions): void
}

type SendVerificationEmailHookState = ActionHookState<'isSent'>

type SendVerificationEmailHookResult = {
  sendEmail: SendVerificationEmailHookHandler
} & SendVerificationEmailHookState

type SendVerificationEmailHook = {
  (options?: SendVerificationEmailOptions): SendVerificationEmailHookResult
  /** @deprecated */
  (email?: string, options?: SendVerificationEmailOptions): SendVerificationEmailHookResult
}
export const useSendVerificationEmail: SendVerificationEmailHook = (
  a?: string | SendVerificationEmailOptions,
  b?: SendVerificationEmailOptions
) => {
  const stateEmail = typeof a === 'string' ? a : undefined
  const stateOptions = typeof a !== 'string' ? a : b
  const nhost = useNhostClient()
  const machine = useMemo(() => createSendVerificationEmailMachine(nhost.auth.client), [nhost])
  const [current, send] = useMachine(machine)
  const isError = current.matches({ idle: 'error' })
  const isSent = current.matches({ idle: 'success' })
  const error = current.context.error
  const isLoading = current.matches('requesting')

  const sendEmail: SendVerificationEmailHookHandler = (
    valueEmail?: string | unknown,
    valueOptions = stateOptions
  ) => {
    send({
      type: 'REQUEST',
      email: typeof valueEmail === 'string' ? valueEmail : stateEmail,
      options: valueOptions
    })
  }
  return { sendEmail, isLoading, isSent, isError, error }
}

// TODO documentation when available in Nhost Cloud - see changelog
export const useConfigMfa = () => {
  const nhost = useNhostClient()

  const machine = useMemo(() => createEnableMfaMachine(nhost.auth.client), [nhost])
  const [current, send] = useMachine(machine)

  const isError = useMemo(() => {
    current.matches({ idle: 'error' }) || current.matches({ generated: { idle: 'error' } })
  }, [current])
  const isGenerating = current.matches('generating')
  const isGenerated = current.matches('generated')
  const isActivating = current.matches({ generated: 'activating' })
  const isActivated = current.matches({ generated: 'activated' })
  const error = current.context.error
  const qrCodeDataUrl = current.context.imageUrl || ''

  const generateQrCode = () => send('GENERATE')
  const activateMfa = (code: string) =>
    send({
      type: 'ACTIVATE',
      activeMfaType: 'totp',
      code
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
