import {
  AuthClient,
  AuthOptions,
  CommonProviderOptions,
  NhostSession,
  PasswordlessOptions,
  Provider,
  RedirectOption,
  SignUpOptions,
  StorageGetter,
  StorageSetter,
  User,
  WorkOsOptions
} from '@nhost/core'
export type { AuthClient, Provider, StorageGetter, StorageSetter, User }
export interface NhostAuthConstructorParams extends AuthOptions {
  url: string
  start?: boolean
  /** @internal @deprecated @alias autoSignIn - use autoSignIn instead  */
  autoLogin?: boolean
}

// Sign Up
export interface SignUpEmailPasswordParams {
  email: string
  password: string
  options?: SignUpOptions
}

export type SignUpParams = SignUpEmailPasswordParams
export interface SignInEmailPasswordParams {
  email: string
  password: string
}

export interface SignInEmailPasswordOtpParams {
  otp: string
  ticket?: string
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

export type SignInWithProviderOptions = { provider: Provider; options?: CommonProviderOptions } & (
  | {
      provider: 'workos'
      options?: WorkOsOptions
    }
  | {
      provider: Exclude<Provider, 'workos'>
    }
)

export type SignInParams =
  | SignInEmailPasswordParams
  | SignInEmailPasswordOtpParams
  | SignInPasswordlessEmailParams
  | SignInPasswordlessSmsOtpParams
  | SignInPasswordlessSmsParams
  | SignInWithProviderOptions

export interface ResetPasswordParams {
  email: string
  options?: RedirectOption
}

export interface ChangePasswordParams {
  newPassword: string
  ticket?: string
}

export interface SendVerificationEmailParams {
  email: string
  options?: RedirectOption
}

export interface ChangeEmailParams {
  newEmail: string
  options?: RedirectOption
}

export type DeanonymizeParams =
  | ({
      signInMethod: 'email-password'
    } & SignUpParams)
  | ({
      signInMethod: 'passwordless'
      connection: 'email'
    } & SignInPasswordlessEmailParams)
  | ({
      signInMethod: 'passwordless'
      connection: 'sms'
    } & SignInPasswordlessSmsParams)

export type AuthChangeEvent = 'SIGNED_IN' | 'SIGNED_OUT'

export type AuthChangedFunction = (event: AuthChangeEvent, session: NhostSession | null) => void

export type OnTokenChangedFunction = (session: NhostSession | null) => void
