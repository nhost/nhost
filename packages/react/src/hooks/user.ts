import { useMemo } from 'react'

import {
  ChangeEmailOptions,
  createChangeEmailMachine,
  createChangePasswordMachine,
  createResetPasswordMachine,
  ResetPasswordOptions
} from '@nhost/client'
import { useMachine, useSelector } from '@xstate/react'

import { useNhost, useNhostInterpreter } from './common'

export const useChangeEmail = (stateEmail?: string, stateOptions?: ChangeEmailOptions) => {
  const nhost = useNhost()
  const machine = useMemo(() => createChangeEmailMachine(nhost), [nhost])
  const [current, send] = useMachine(machine)

  const isError = current.matches({ idle: 'error' })
  const needsVerification = current.matches({ idle: 'success' })
  const error = current.context.error
  const isLoading = current.matches('requesting')

  const changeEmail = (valueEmail?: string | unknown, valueOptions = stateOptions) =>
    send({
      type: 'REQUEST_CHANGE',
      email: typeof valueEmail === 'string' ? valueEmail : stateEmail,
      options: valueOptions
    })
  return { changeEmail, isLoading, needsVerification, isError, error }
}

export const useChangePassword = (statePassword?: string) => {
  const nhost = useNhost()
  const machine = useMemo(() => createChangePasswordMachine(nhost), [nhost])
  const [current, send] = useMachine(machine)
  const isError = current.matches({ idle: 'error' })
  const isSuccess = current.matches({ idle: 'success' })
  const error = current.context.error
  const isLoading = current.matches('requesting')

  const changePassword = (valuePassword?: string | unknown) =>
    send({
      type: 'REQUEST_CHANGE',
      password: typeof valuePassword === 'string' ? valuePassword : statePassword
    })

  return { changePassword, isLoading, isSuccess, isError, error }
}

export const useResetPassword = (stateEmail?: string, stateOptions?: ResetPasswordOptions) => {
  const nhost = useNhost()
  const machine = useMemo(() => createResetPasswordMachine(nhost), [nhost])
  const [current, send] = useMachine(machine)
  const isError = current.matches({ idle: 'error' })
  const isSent = current.matches({ idle: 'success' })
  const error = current.context.error
  const isLoading = current.matches('requesting')

  const resetPassword = (valueEmail?: string | unknown, valueOptions = stateOptions) =>
    send({
      type: 'REQUEST_CHANGE',
      email: typeof valueEmail === 'string' ? valueEmail : stateEmail,
      options: valueOptions
    })
  return { resetPassword, isLoading, isSent, isError, error }
}

export const useUserData = () => {
  const service = useNhostInterpreter()
  return useSelector(service, (state) => state.context.user)
}

export const useAvatarUrl = () => {
  const service = useNhostInterpreter()
  return useSelector(service, (state) => state.context.user?.avatarUrl)
}

export const useDefaultRole = () => {
  const service = useNhostInterpreter()
  return useSelector(service, (state) => state.context.user?.defaultRole)
}

export const useDisplayName = () => {
  const service = useNhostInterpreter()
  return useSelector(service, (state) => state.context.user?.displayName)
}

export const useEmail = () => {
  const service = useNhostInterpreter()
  return useSelector(service, (state) => state.context.user?.email)
}

export const useUserId = () => {
  const service = useNhostInterpreter()
  return useSelector(service, (state) => state.context.user?.id)
}

export const useIsAnonymous = () => {
  const service = useNhostInterpreter()
  return useSelector(service, (state) => state.context.user?.isAnonymous)
}

export const useUserLocale = () => {
  const service = useNhostInterpreter()
  return useSelector(service, (state) => state.context.user?.locale)
}

export const useUserRoles = () => {
  const service = useNhostInterpreter()
  return useSelector(service, (state) => state.context.user?.roles || [])
}
