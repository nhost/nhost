// TODO create a dedicated package for types

import { InterpreterFrom } from 'xstate'

import { AuthMachine } from './machines'

// TODO import generated typings from 'hasura-auth'
export type AuthInterpreter = InterpreterFrom<AuthMachine>
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
export type ResetPasswordOptions = RedirectOption
export type SendVerificationEmailOptions = RedirectOption

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

export type Mfa = {
  ticket: string
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
