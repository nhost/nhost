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

export type RedirectOption = {
  redirectTo?: string
}

export type PasswordlessOptions = RegistrationOptions & RedirectOption
export type SignUpOptions = RegistrationOptions & RedirectOption
export type ChangeEmailOptions = RedirectOption
export type ResetPasswordOptions = RedirectOption
export type SendVerificationEmailOptions = RedirectOption
export type DeanonymizeOptions = { email?: string; password?: string } & RegistrationOptions
export type ProviderOptions = RegistrationOptions & RedirectOption

// TODO share with hasura-auth
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
  emailVerified: boolean
  phoneNumber: string | null
  phoneNumberVerified: boolean
  activeMfaType: 'totp' | null
}

// TODO share with hasura-auth
export type NhostSession = {
  accessToken: string
  accessTokenExpiresIn: number
  refreshToken: string
  user: User
}

export type Mfa = {
  ticket: string
}

// TODO share with hasura-auth
export type Provider =
  | 'apple'
  | 'facebook'
  | 'github'
  | 'google'
  | 'linkedin'
  | 'spotify'
  | 'twitter'
  | 'windowslive'
  | 'strava'
  | 'gitlab'
  | 'bitbucket'

// TODO share with hasura-auth
export interface JWTHasuraClaims {
  // ? does not work as expected: if the key does not start with `x-hasura-`, then it is typed as `any`
  // [claim: `x-hasura-${string}`]: string | string[]
  [claim: string]: string | string[] | null
  'x-hasura-allowed-roles': string[]
  'x-hasura-default-role': string
  'x-hasura-user-id': string
  'x-hasura-user-is-anonymous': string
}

// https://hasura.io/docs/1.0/graphql/core/auth/authentication/jwt.html#the-spec
export interface JWTClaims {
  sub?: string
  iat?: number
  'https://hasura.io/jwt/claims': JWTHasuraClaims
}
