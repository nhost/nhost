// TODO create a dedicated package for types

import { InterpreterFrom } from 'xstate'

import { AuthMachine } from './machines'
import { StorageGetter, StorageSetter } from './storage'

export interface AuthOptions {
  /** Time interval until token refreshes, in seconds */
  refreshIntervalTime?: number
  clientStorage?: ClientStorage
  /** @default web */
  clientStorageType?: ClientStorageType
  /**
   * Define a way to get information about the refresh token and its exipration date.
   * @deprecated Use clientStorage / clientStorageType instead */
  clientStorageGetter?: StorageGetter
  /**
   * Define a way to set information about the refresh token and its exipration date.
   * @deprecated  Use clientStorage / clientStorageType instead */
  clientStorageSetter?: StorageSetter
  /** When set to true, will automatically refresh token before it expires */
  autoRefreshToken?: boolean
  /** When set to true, will parse the url on startup to check if it contains a refresh token to start the session with */
  autoSignIn?: boolean
}
// TODO import generated typings from 'hasura-auth'
export type AuthInterpreter = InterpreterFrom<AuthMachine>
interface RegistrationOptions {
  /**
   * Locale of the user, in two digits
   * @example `'en'`
   */
  locale?: string
  /**
   * Allowed roles of the user. Must be a subset of the default allowed roles defined in Hasura Auth.
   * @example `['user','me']`
   */
  allowedRoles?: string[]
  /**
   * Default role of the user. Must be part of the default allowed roles defined in Hasura Auth.
   * @example `'user'`
   */
  defaultRole?: string
  /**
   * Display name of the user. If not provided, it will use the display name given by the social provider (Oauth) used on registration, or the email address otherwise.
   */
  displayName?: string
  /**
   * Custom additional user information stored in the `metadata` column. Can be any JSON object.
   * @example `{ firstName: 'Bob', profession: 'builder' }`
   */
  metadata?: Record<string, unknown>
}

export interface RedirectOption {
  /**
   * Redirection path in the client application that will be used in the link in the verification email.
   * For instance, if you want to redirect to `https://myapp.com/success`, the `redirectTo` value is `'/success'`.
   */
  redirectTo?: string
}

export interface PasswordlessOptions extends RegistrationOptions, RedirectOption {}
export interface SignUpOptions extends RegistrationOptions, RedirectOption {}
export interface ChangeEmailOptions extends RedirectOption {}
export interface ResetPasswordOptions extends RedirectOption {}
export interface SendVerificationEmailOptions extends RedirectOption {}
export interface DeanonymizeOptions extends RegistrationOptions {
  email?: string
  password?: string
}
export interface ProviderOptions extends RegistrationOptions, RedirectOption {}

// TODO share with hasura-auth
/** User information */
export interface User {
  /** User's unique identifier (uuid) */
  id: string
  /** The date-time when the user has been created */
  createdAt: string
  /** User's display name */
  displayName: string
  /** The URL to the user's profile picture */
  avatarUrl: string
  /** The locale of the user, as a two-characters string
   * @example `'en'`
   */
  locale: string
  /** User's email address */
  email?: string
  /** Whether or not the user is anonymous */
  isAnonymous: boolean
  /** The default role of the user
   * @example `'user'`
   */
  defaultRole: string
  /** The roles assigned to the user
   * @example `['user', 'me']`
   */
  roles: string[]
  /** Additional attributes used for user information */
  metadata: Record<string, unknown>
  /** Is `true` if the user email has not been verified */
  emailVerified: boolean
  phoneNumber: string | null
  phoneNumberVerified: boolean
  activeMfaType: 'totp' | null
}

// TODO share with hasura-auth
export interface NhostSession {
  accessToken: string
  accessTokenExpiresIn: number
  refreshToken: string
  user: User
}

export interface Mfa {
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

/**
 * Basic structure of a JWT that contains the default Hasura namespace.
 * @see {@link https://hasura.io/docs/1.0/graphql/core/auth/authentication/jwt.html#the-spec}
 */
export interface JWTClaims {
  sub?: string
  iat?: number
  'https://hasura.io/jwt/claims': JWTHasuraClaims
}

export interface ClientStorage {
  // custom
  // localStorage
  // AsyncStorage
  // https://react-native-community.github.io/async-storage/docs/usage
  setItem?: (_key: string, _value: string) => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getItem?: (key: string) => any
  removeItem?: (key: string) => void

  // capacitor
  set?: (options: { key: string; value: string }) => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get?: (options: { key: string }) => any
  remove?: (options: { key: string }) => void

  // expo-secure-storage
  setItemAsync?: (key: string, value: string) => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getItemAsync?: (key: string) => any
  deleteItemAsync?: (key: string) => void
  customGet?: (key: string) => Promise<string | null> | string | null
  customSet?: (key: string, value: string | null) => Promise<void> | void
}

// supported client storage types
export type ClientStorageType =
  | 'capacitor'
  | 'custom'
  | 'expo-secure-storage'
  | 'localStorage'
  | 'react-native'
  | 'web'
  | 'cookie'
