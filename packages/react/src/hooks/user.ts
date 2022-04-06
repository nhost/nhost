import { useMemo, useState } from 'react'

import {
  ChangeEmailOptions,
  createChangeEmailMachine,
  createChangePasswordMachine,
  createEnableMfaMachine,
  createResetPasswordMachine,
  createSendVerificationEmailMachine,
  ErrorPayload,
  ResetPasswordOptions,
  SendVerificationEmailOptions
} from '@nhost/core'
import { useMachine, useSelector } from '@xstate/react'

import { ActionHookState, useAuthInterpreter, useNhostClient } from './common'

type ChangeEmailHookState = ActionHookState<'needsEmailVerification'>
type ChangeEmailHandlerResult = Omit<ChangeEmailHookState, 'isLoading'>
type ChangeEmailHandler = {
  (email: string, options?: ChangeEmailOptions): Promise<ChangeEmailHandlerResult>
  /** @deprecated */
  (email?: unknown, options?: ChangeEmailOptions): Promise<ChangeEmailHandlerResult>
}

type ChangeEmailHookResult = {
  changeEmail: ChangeEmailHandler
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

type ChangePasswordHandlerResult = Omit<ActionHookState, 'isLoading'>
type ChangePasswordHandler = {
  (password: string): Promise<ChangePasswordHandlerResult>
  /** @deprecated */
  (password?: unknown): Promise<ChangePasswordHandlerResult>
}

type ChangePasswordHookResult = {
  changePassword: ChangePasswordHandler
} & ActionHookState

type ChangePasswordHook = {
  (): ChangePasswordHookResult
  /** @deprecated */
  (email?: string): ChangePasswordHookResult
}

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
type ResetPasswordHandler = {
  (email: string, options?: ResetPasswordOptions): Promise<ResetPasswordHandlerResult>
  /** @deprecated */
  (email?: unknown, options?: ResetPasswordOptions): Promise<ResetPasswordHandlerResult>
}

type ResetPasswordHookState = ActionHookState<'isSent'>

type ResetPasswordHookResult = {
  resetPassword: ResetPasswordHandler
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

type SendVerificationEmailHandlerResult = Omit<SendVerificationEmailHookState, 'isLoading'>
type SendVerificationEmailHandler = {
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

type SendVerificationEmailHookState = ActionHookState<'isSent'>

type SendVerificationEmailHookResult = {
  sendEmail: SendVerificationEmailHandler
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

type ActivateMfaHookState = {
  isActivating: boolean
  isActivated: boolean
  isError: boolean
  error: ErrorPayload | null
}
type GenerateQrCodeHookState = {
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

type ConfigMfaHookState = ActivateMfaHookState &
  GenerateQrCodeHookState & {
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
