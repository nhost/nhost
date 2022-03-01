// TODO create a dedicated package for types
// TODO import generated typings from 'hasura-auth'

type RegistrationOptions = {
  locale?: string
  allowedRoles?: string[]
  defaultRole?: string
  displayName?: string
  metadata?: Record<string, unknown>
}

type RedirectOption = {
  redirectTo?: string
}

export type PasswordlessOptions = RegistrationOptions & RedirectOption
export type SignUpOptions = RegistrationOptions & RedirectOption
export type ChangeEmailOptions = RedirectOption

export type User = {
  id: string
  createdAt: string
  displayName: string
  avatarUrl: string
  locale: string
  email?: string
  isAnonymous: boolean
  defaultRole: string
  roles: string[]
  metadata: Record<string, unknown>
}

// ! copy-paste from hasura-auth
export type NhostSession = {
  accessToken: string
  accessTokenExpiresIn: number
  refreshToken: string
  user: User
}

export type Provider =
  | 'apple'
  | 'facebook'
  | 'github'
  | 'google'
  | 'linkedin'
  | 'spotify'
  | 'twitter'
  | 'windowslive'
