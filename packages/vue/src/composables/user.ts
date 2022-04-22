import { computed } from 'vue'

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
import { useMachine, useSelector } from '@xstate/vue'

import { useAuthInterpreter, useNhostClient } from './common'

export const useChangeEmail = (stateEmail?: string, stateOptions?: ChangeEmailOptions) => {
  const nhost = useNhostClient()
  const { state, send } = useMachine(createChangeEmailMachine(nhost.value.auth.client))

  const isError = computed(() => state.value.matches({ idle: 'error' }))
  const needsEmailVerification = computed(() => state.value.matches({ idle: 'success' }))
  const error = computed(() => state.value.context.error)
  const isLoading = computed(() => state.value.matches('requesting'))

  const changeEmail = (valueEmail?: string | unknown, valueOptions = stateOptions) =>
    send({
      type: 'REQUEST',
      email: typeof valueEmail === 'string' ? valueEmail : stateEmail,
      options: valueOptions
    })
  return { changeEmail, isLoading, needsEmailVerification, isError, error }
}

export const useChangePassword = (statePassword?: string) => {
  const nhost = useNhostClient()
  const { state, send } = useMachine(createChangePasswordMachine(nhost.value.auth.client))
  const isError = computed(() => state.value.matches({ idle: 'error' }))
  const isSuccess = computed(() => state.value.matches({ idle: 'success' }))
  const error = computed(() => state.value.context.error)
  const isLoading = computed(() => state.value.matches('requesting'))

  const changePassword = (valuePassword?: string | unknown) =>
    send({
      type: 'REQUEST',
      password: typeof valuePassword === 'string' ? valuePassword : statePassword
    })

  return { changePassword, isLoading, isSuccess, isError, error }
}

export const useResetPassword = (stateEmail?: string, stateOptions?: ResetPasswordOptions) => {
  const nhost = useNhostClient()
  const { state, send } = useMachine(createResetPasswordMachine(nhost.value.auth.client))
  const isError = state.value.matches({ idle: 'error' })
  const isSent = state.value.matches({ idle: 'success' })
  const error = state.value.context.error
  const isLoading = state.value.matches('requesting')

  const resetPassword = (valueEmail?: string | unknown, valueOptions = stateOptions) =>
    send({
      type: 'REQUEST',
      email: typeof valueEmail === 'string' ? valueEmail : stateEmail,
      options: valueOptions
    })
  return { resetPassword, isLoading, isSent, isError, error }
}

export const useUserData = () => {
  const service = useAuthInterpreter()
  return useSelector(
    service.value,
    (state) => state.context.user,
    (a, b) => JSON.stringify(a) === JSON.stringify(b)
  )
}

export const useAvatarUrl = () => {
  const service = useAuthInterpreter()
  return useSelector(
    service.value,
    (state) => state.context.user?.avatarUrl,
    (a, b) => a === b
  )
}

export const useDefaultRole = () => {
  const service = useAuthInterpreter()
  return useSelector(
    service.value,
    (state) => state.context.user?.defaultRole,
    (a, b) => a === b
  )
}

export const useDisplayName = () => {
  const service = useAuthInterpreter()
  return useSelector(
    service.value,
    (state) => state.context.user?.displayName,
    (a, b) => a === b
  )
}

export const useEmail = () => {
  const service = useAuthInterpreter()
  return useSelector(
    service.value,
    (state) => state.context.user?.email,
    (a, b) => a === b
  )
}

export const useUserId = () => {
  const service = useAuthInterpreter()
  return useSelector(
    service.value,
    (state) => state.context.user?.id,
    (a, b) => a === b
  )
}

export const useIsAnonymous = () => {
  const service = useAuthInterpreter()
  return useSelector(
    service.value,
    (state) => state.context.user?.isAnonymous,
    (a, b) => a === b
  )
}

export const useUserLocale = () => {
  const service = useAuthInterpreter()
  return useSelector(
    service.value,
    (state) => state.context.user?.locale,
    (a, b) => a === b
  )
}

export const useUserRoles = () => {
  const service = useAuthInterpreter()
  return useSelector(
    service.value,
    (state) => state.context.user?.roles || [],
    (a, b) => a.every((i) => b.includes(i) && b.every((i) => a.includes(i)))
  )
}

export const useSendVerificationEmail = (
  stateEmail?: string,
  stateOptions?: SendVerificationEmailOptions
) => {
  const nhost = useNhostClient()
  const { state, send } = useMachine(createSendVerificationEmailMachine(nhost.value.auth.client))
  const isError = computed(() => state.value.matches({ idle: 'error' }))
  const isSent = computed(() => state.value.matches({ idle: 'success' }))
  const error = computed(() => state.value.context.error)
  const isLoading = computed(() => state.value.matches('requesting'))

  const sendEmail = (valueEmail?: string | unknown, valueOptions = stateOptions) =>
    send({
      type: 'REQUEST',
      email: typeof valueEmail === 'string' ? valueEmail : stateEmail,
      options: valueOptions
    })
  return { sendEmail, isLoading, isSent, isError, error }
}

// TODO documentation when available in Nhost Cloud - see changelog
export const useConfigMfa = (stateCode?: string) => {
  const nhost = useNhostClient()

  const { state, send } = useMachine(createEnableMfaMachine(nhost.value.auth.client))

  const isError = computed(() => {
    state.value.matches({ idle: 'error' }) || state.value.matches({ generated: { idle: 'error' } })
  })
  const isGenerating = computed(() => state.value.matches('generating'))
  const isGenerated = computed(() => state.value.matches('generated'))
  const isActivating = computed(() => state.value.matches({ generated: 'activating' }))
  const isActivated = computed(() => state.value.matches({ generated: 'activated' }))
  const error = computed(() => state.value.context.error)
  const qrCodeDataUrl = computed(() => state.value.context.imageUrl || '')

  const generateQrCode = () => send('GENERATE')
  const activateMfa = (valueCode?: string | unknown) =>
    send({
      type: 'ACTIVATE',
      activeMfaType: 'totp',
      code: typeof valueCode === 'string' ? valueCode : stateCode
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
