import { useSelector } from '@xstate/react'

import { useNhostInterpreter } from './common'

export const useChangeEmail = (stateEmail?: string) => {
  const service = useNhostInterpreter()
  const hasError = useSelector(service, (state) =>
    state.matches({ authentication: { signedIn: { changeEmail: { idle: 'failed' } } } })
  )
  const error = useSelector(service, (state) => state.context.errors.newEmail)
  const loading = useSelector(service, (state) =>
    state.matches({ authentication: { signedIn: { changeEmail: 'running' } } })
  )
  const success = useSelector(service, (state) =>
    state.matches({ authentication: { signedIn: { changeEmail: { idle: 'success' } } } })
  )

  const needsVerification = useSelector(service, (state) =>
    state.matches({ authentication: { signedIn: { changeEmail: { idle: 'needsVerification' } } } })
  )

  const change = (valueEmail?: string) =>
    service.send({
      type: 'CHANGE_EMAIL',
      email: valueEmail ?? stateEmail
    })
  return { change, loading, success, needsVerification, hasError, error }
}

export const useChangePassword = (statePassword?: string) => {
  const service = useNhostInterpreter()

  const hasError = useSelector(service, (state) =>
    state.matches({ authentication: { signedIn: { changePassword: { idle: 'failed' } } } })
  )
  const error = useSelector(service, (state) => state.context.errors.newPassword)
  const loading = useSelector(service, (state) =>
    state.matches({ authentication: { signedIn: { changePassword: 'running' } } })
  )
  const success = useSelector(service, (state) =>
    state.matches({ authentication: { signedIn: { changePassword: { idle: 'success' } } } })
  )

  const change = (valuePassword?: string) =>
    service.send({
      type: 'CHANGE_PASSWORD',
      password: valuePassword ?? statePassword
    })
  return { change, loading, success, hasError, error }
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
