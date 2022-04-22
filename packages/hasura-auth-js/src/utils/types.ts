import {
  AuthClient,
  PasswordlessOptions,
  Provider,
  ProviderOptions,
  RedirectOption,
  SignUpOptions,
  StorageGetter,
  StorageSetter,
  User
} from '@nhost/core'
export type { AuthClient, Provider, StorageGetter, StorageSetter, User }
export interface NhostAuthConstructorParams {
  url: string
  /** Time interval until token refreshes, in seconds */
  refreshIntervalTime?: number
  /** @deprecated Use clientStorageGetter and clientStorageSetter options instead */
  clientStorage?: ClientStorage
  /** @deprecated Use clientStorageGetter and clientStorageSetter options instead */
  clientStorageType?: ClientStorageType
  /** Define a way to get information about the refresh token and its exipration date */
  clientStorageGetter?: StorageGetter
  /** Define a way to set information about the refresh token and its exipration date */
  clientStorageSetter?: StorageSetter
  /** When set to true, will automatically refresh token before it expires */
  autoRefreshToken?: boolean
  /** When set to true, will parse the url on startup to check if it contains a refresh token to start the session with */
  autoLogin?: boolean
  start?: boolean
  Client?: typeof AuthClient
}

export interface Session {
  accessToken: string
  accessTokenExpiresIn: number
  refreshToken: string
  user: User | null
}
export interface ApiError {
  message: string
  status: number
}

// Sign Up
export interface SignUpEmailPasswordParams {
  email: string
  password: string
  options?: SignUpOptions
}

export type SignUpParams = SignUpEmailPasswordParams

export type SignUpResponse =
  | { session: null; error: ApiError }
  | { session: Session | null; error: null }

// Sign In
export interface SignInEmailPasswordParams {
  email: string
  password: string
}

export interface SignInPasswordlessEmailParams {
  email: string
  options?: PasswordlessOptions
}

export interface SignInPasswordlessSmsParams {
  phoneNumber: string
  options?: PasswordlessOptions
}

export interface SignInPasswordlessSmsOtpParams {
  phoneNumber: string
  otp: string
}
export interface SignInWithProviderOptions {
  provider: Provider
  options?: ProviderOptions
}

export type SignInParams =
  | SignInEmailPasswordParams
  | SignInPasswordlessEmailParams
  | SignInPasswordlessSmsOtpParams
  | SignInPasswordlessSmsParams
  | SignInWithProviderOptions

export interface ResetPasswordParams {
  email: string
  options?: {
    redirectTo?: string
  }
}

export interface ChangePasswordParams {
  newPassword: string
}

export interface SendVerificationEmailParams {
  email: string
  options?: RedirectOption
}

export interface ChangeEmailParams {
  newEmail: string
  options?: RedirectOption
}

// TODO define type in @nhost/core
export interface DeanonymizeParams {
  signInMethod: 'email-password' | 'passwordless'
  email: string
  password?: string
  connection?: 'email' | 'sms'
  defaultRole?: string
  allowedRoles?: string[]
}

export interface SignInReponse {
  session: Session | null
  error: ApiError | null
  mfa?: {
    enabled: boolean
    ticket: string
  }
  providerUrl?: string
  provider?: string
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
}

// supported client storage types
export type ClientStorageType =
  | 'capacitor'
  | 'custom'
  | 'expo-secure-storage'
  | 'localStorage'
  | 'react-native'
  | 'web'

export type AuthChangeEvent = 'SIGNED_IN' | 'SIGNED_OUT'

export type AuthChangedFunction = (event: AuthChangeEvent, session: Session | null) => void

export type OnTokenChangedFunction = (session: Session | null) => void

export interface LoginData {
  mfa?: boolean
  ticket?: string
}

export interface Headers {
  Authorization?: string
}

export interface JWTHasuraClaims {
  [claim: string]: string[] | string
  'x-hasura-allowed-roles': string[]
  'x-hasura-default-role': string
  'x-hasura-user-id': string
}

// https://hasura.io/docs/1.0/graphql/core/auth/authentication/jwt.html#the-spec
export interface JWTClaims {
  sub?: string
  iat?: number
  'https://hasura.io/jwt/claims': JWTHasuraClaims
}

/// //////////////////
/// // API
/// //////////////////

export interface Mfa {
  ticket: string
}

export type ApiSignUpEmailPasswordResponse =
  | { session: null; error: ApiError }
  | { session: Session; error: null }

export interface ApiSignInData {
  session: Session
  mfa: Mfa | null
}
export type ApiSignInResponse =
  | {
      data: ApiSignInData
      error: null
    }
  | { data: null; error: ApiError }

export type ApiRefreshTokenResponse =
  | { session: null; error: ApiError }
  | { session: Session; error: null }

export interface ApiSignOutResponse {
  error: ApiError | null
}

export interface ApiResetPasswordResponse {
  error: ApiError | null
}

export interface ApiChangePasswordResponse {
  error: ApiError | null
}

export interface ApiSendVerificationEmailResponse {
  error: ApiError | null
}

export interface ApiChangeEmailResponse {
  error: ApiError | null
}

export interface ApiDeanonymizeResponse {
  error: ApiError | null
}
