import { useSelector } from '@xstate/react'
import { useAuthService } from './common'

export const useChangeEmail = (email: string) => {
  const service = useAuthService()
  const hasError = useSelector(service, (state) =>
    state.matches({ authentication: { signedIn: { changeEmail: { idle: 'failed' } } } })
  )
  const error = useSelector(service, (state) => state.context.errors.newEmail)
  const isValid = useSelector(
    service,
    (state) =>
      !state.matches({ authentication: { signedIn: { changeEmail: { idle: 'invalid' } } } })
  )
  const loading = useSelector(service, (state) =>
    state.matches({ authentication: { signedIn: { changeEmail: 'running' } } })
  )
  const success = useSelector(service, (state) =>
    state.matches({ authentication: { signedIn: { changeEmail: { idle: 'success' } } } })
  )

  const needsVerification = useSelector(service, (state) =>
    state.matches({ authentication: { signedIn: { changeEmail: { idle: 'needsVerification' } } } })
  )

  const change = () =>
    service.send({
      type: 'CHANGE_EMAIL',
      email
    })
  return { change, loading, success, needsVerification, hasError, error, isValid }
}

export const useChangePassword = (password: string) => {
  const service = useAuthService()

  const hasError = useSelector(service, (state) =>
    state.matches({ authentication: { signedIn: { changePassword: { idle: 'failed' } } } })
  )
  const error = useSelector(service, (state) => state.context.errors.newPassword)
  const isValid = useSelector(
    service,
    (state) =>
      !state.matches({ authentication: { signedIn: { changePassword: { idle: 'invalid' } } } })
  )
  const loading = useSelector(service, (state) =>
    state.matches({ authentication: { signedIn: { changePassword: 'running' } } })
  )
  const success = useSelector(service, (state) =>
    state.matches({ authentication: { signedIn: { changePassword: { idle: 'success' } } } })
  )

  const change = () =>
    service.send({
      type: 'CHANGE_PASSWORD',
      password
    })
  return { change, loading, success, hasError, error, isValid }
}

export const useUserData = () => {
  const service = useAuthService()
  return useSelector(service, (state) => state.context.user)
}

export const useAvatarUrl = () => {
  const service = useAuthService()
  return useSelector(service, (state) => state.context.user?.avatarUrl)
}

export const useDefaultRole = () => {
  const service = useAuthService()
  return useSelector(service, (state) => state.context.user?.defaultRole)
}

export const useDisplayName = () => {
  const service = useAuthService()
  return useSelector(service, (state) => state.context.user?.displayName)
}

export const useEmail = () => {
  const service = useAuthService()
  return useSelector(service, (state) => state.context.user?.email)
}

export const useUserId = () => {
  const service = useAuthService()
  return useSelector(service, (state) => state.context.user?.id)
}

export const useIsAnonymous = () => {
  const service = useAuthService()
  return useSelector(service, (state) => state.context.user?.isAnonymous)
}

export const useUserLocale = () => {
  const service = useAuthService()
  return useSelector(service, (state) => state.context.user?.locale)
}

export const useUserRoles = () => {
  const service = useAuthService()
  return useSelector(service, (state) => state.context.user?.roles)
}
