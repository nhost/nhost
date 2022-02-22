import { useSelector } from '@xstate/react'

import { useNhostInterpreter } from './common'

export const useChangeEmail = (stateEmail?: string) => {
  const service = useNhostInterpreter()
  const isError = useSelector(service, (state) =>
    state.matches({ authentication: { signedIn: { changeEmail: { idle: 'failed' } } } })
  )
  const error = useSelector(service, (state) => state.context.errors.newEmail)
  const isLoading = useSelector(service, (state) =>
    state.matches({ authentication: { signedIn: { changeEmail: 'running' } } })
  )
  const isSuccess = useSelector(service, (state) =>
    state.matches({ authentication: { signedIn: { changeEmail: { idle: 'success' } } } })
  )

  const needsVerification = useSelector(service, (state) =>
    state.matches({ authentication: { signedIn: { changeEmail: { idle: 'needsVerification' } } } })
  )

  const changeEmail = (valueEmail?: string | unknown) =>
    service.send({
      type: 'CHANGE_EMAIL',
      email: typeof valueEmail === 'string' ? valueEmail : stateEmail
    })
  return { changeEmail, isLoading, isSuccess, needsVerification, isError, error }
}

export const useChangePassword = (statePassword?: string) => {
  const service = useNhostInterpreter()

  const isError = useSelector(service, (state) =>
    state.matches({ authentication: { signedIn: { changePassword: { idle: 'failed' } } } })
  )
  const error = useSelector(service, (state) => state.context.errors.newPassword)
  const isLoading = useSelector(service, (state) =>
    state.matches({ authentication: { signedIn: { changePassword: 'running' } } })
  )
  const isSuccess = useSelector(service, (state) =>
    state.matches({ authentication: { signedIn: { changePassword: { idle: 'success' } } } })
  )

  const changePassword = (valuePassword?: string | unknown) =>
    service.send({
      type: 'CHANGE_PASSWORD',
      password: typeof valuePassword === 'string' ? valuePassword : statePassword
    })
  return { changePassword, isLoading, isSuccess, isError, error }
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
