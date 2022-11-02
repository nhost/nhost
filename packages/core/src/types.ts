// TODO create a dedicated package for types

import { InterpreterFrom } from 'xstate'

import { ErrorPayload } from './errors'
import { AuthMachine } from './machines'
import { StorageGetter, StorageSetter } from './storage'

export interface AuthOptions {
  /** Time interval until token refreshes, in seconds */
  refreshIntervalTime?: number
  /**
   * Define a way to get information about the refresh token and its exipration date.
   * @default web */
  clientStorageType?: ClientStorageType
  /** Object where the refresh token will be persisted and read locally.
   *
   * Recommended values:
   * - `'web'` and `'cookies'`: no value is required
   * - `'react-native'`: `import Storage from @react-native-async-storage/async-storage`
   * - `'cookies'`: `localStorage`
   * - `'custom'`: an object that defines the following methods:
   *     - `setItem` or `setItemAsync`
   *     - `getItem` or `getItemAsync`
   *     - `removeItem`
   * - `'capacitor'`: `import { Storage } from @capacitor/storage`
   * - `'expo-secure-store'`: `import * as SecureStore from 'expo-secure-store'`
   */
  clientStorage?: ClientStorage
  /**
   *  @internal @deprecated Use clientStorage / clientStorageType instead  */
  clientStorageGetter?: StorageGetter
  /**
   * Define a way to set information about the refresh token and its exipration date.
   * @internal @deprecated  Use clientStorage / clientStorageType instead  */
  clientStorageSetter?: StorageSetter
  /** When set to true, will automatically refresh token before it expires */
  autoRefreshToken?: boolean
  /** When set to true, will parse the url on startup to check if it contains a refresh token to start the session with */
  autoSignIn?: boolean
  /** Activate devTools e.g. the ability to connect to the xstate inspector */
  devTools?: boolean
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
export interface SignUpSecurityKeyOptions extends SignUpOptions {
  /** Optional nickname for the security key */
  nickname?: string
}

export interface ChangeEmailOptions extends RedirectOption {}
export interface ResetPasswordOptions extends RedirectOption {}
export interface SendVerificationEmailOptions extends RedirectOption {}
export interface DeanonymizeOptions extends RegistrationOptions {
  email?: string
  password?: string
}

export interface CommonProviderOptions extends RegistrationOptions, RedirectOption {}
export interface WorkOsOptions extends CommonProviderOptions {
  connection?: string
  organization?: string
  provider?: string
}
export interface ProviderOptions extends CommonProviderOptions, WorkOsOptions {}

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
  | 'discord'
  | 'twitch'
  | 'workos'

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

// Hasura-auth API response types
interface NullableErrorResponse {
  error: ErrorPayload | null
}

/** session payload from common hasura-auth responses */
export type NhostSessionResponse =
  | { session: null; error: ErrorPayload }
  | { session: NhostSession | null; error: null }

/** payload from hasura-auth endpoint /signin/email-password */
export interface SignInResponse {
  session: NhostSession | null
  mfa: {
    ticket: string
  } | null
  error: ErrorPayload | null
}

/** payload from hasura-auth endpoint /signup/email-password */
export type SignUpResponse = NhostSessionResponse

/** payload from hasura-auth endpoint /token */
export type RefreshSessionResponse = NhostSession

/** payload from hasura-auth endpoint /signout */
export interface SignOutResponse extends NullableErrorResponse {}

/** payload from hasura-auth endpoint /user/password/reset */
export interface ResetPasswordResponse extends NullableErrorResponse {}

/** payload from hasura-auth endpoint /user/password */
export interface ChangePasswordResponse extends NullableErrorResponse {}

/** payload from hasura-auth endpoint /user/email/send-verification-email */
export interface SendVerificationEmailResponse extends NullableErrorResponse {}

/** payload from hasura-auth endpoint /user/email/change */
export interface ChangeEmailResponse extends NullableErrorResponse {}

/** payload from hasura-auth endpoint /user/deanonymize */
export interface DeanonymizeResponse extends NullableErrorResponse {}

/** payload from hasura-auth endpoint /signin/passwordless/email */
export interface PasswordlessEmailResponse extends NullableErrorResponse {}

/** payload from hasura-auth endpoint /signin/passwordless/sms */
export interface PasswordlessSmsResponse extends NullableErrorResponse {}

/** payload from hasura-auth endpoint /signin/anonymous */
export type SignInAnonymousResponse = NhostSessionResponse

/** payload from hasura-auth endpoint /signin/anonymous */
export type PasswordlessSmsOtpResponse = NhostSessionResponse

/** payload from hasura-auth endpoint /signin/mfa/totp */
export type SignInMfaTotpResponse = NhostSessionResponse

/** Data of a WebAuthn security key */
export interface SecurityKey {
  /** Unique indentifier of the security key */
  id: string
  /** Human-readable nickname fof the security key */
  nickname?: string
}
