import {
  AuthClient,
  AuthOptions,
  CommonProviderOptions,
  NhostSession,
  PasswordlessOptions,
  Provider,
  RedirectOption,
  SignUpOptions,
  SignUpSecurityKeyOptions,
  StorageGetter,
  StorageSetter,
  User,
  WorkOsOptions
} from '@nhost/core'
export type { AuthClient, Provider, StorageGetter, StorageSetter, User }
export interface NhostAuthConstructorParams extends AuthOptions {
  url: string
  start?: boolean
}

// Sign Up
export interface CommonSignUpParams {
  options?: SignUpOptions
}

export interface SignUpEmailPasswordParams extends CommonSignUpParams {
  email: string
  password: string
}

export interface SignUpSecurityKeyParams extends CommonSignUpParams {
  email: string
  options?: SignUpSecurityKeyOptions
  securityKey: true
}

export type SignUpParams = SignUpEmailPasswordParams | SignUpSecurityKeyParams
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

export interface SignInPasswordlessSecurityKeyParams {
  email: string
  securityKey: true
}

export interface SignInPasswordlessSmsParams {
  phoneNumber: string
  options?: PasswordlessOptions
}

export interface SignInPasswordlessSmsOtpParams {
  phoneNumber: string
  otp: string
}

export type SignInWithProviderOptions =
  | { provider: Exclude<Provider, 'workos'>; options?: CommonProviderOptions }
  | { provider: 'workos'; options?: WorkOsOptions }

export type SignInParams =
  | SignInEmailPasswordParams
  | SignInEmailPasswordOtpParams
  | SignInPasswordlessEmailParams
  | SignInPasswordlessSecurityKeyParams
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
    } & SignUpEmailPasswordParams)
  // TODO deanonymise with security key
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
