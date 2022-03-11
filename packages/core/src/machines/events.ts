import type { ErrorPayload } from '../errors'
import type { DeanonymizeOptions, NhostSession, PasswordlessOptions, SignUpOptions } from '../types'

export type AuthEvents =
  | { type: 'SESSION_UPDATE'; data: { session: NhostSession } }
  | { type: 'TRY_TOKEN'; token: string }
  | { type: 'SIGNIN_ANONYMOUS' }
  | {
    type: 'DEANONYMIZE',
    signInMethod: 'email-password' | 'passwordless'
    connection?: 'email' | 'sms'
    options: DeanonymizeOptions
  }
  | { type: 'SIGNIN_PASSWORD'; email?: string; password?: string }
  | {
    type: 'SIGNIN_PASSWORDLESS_EMAIL'
    email?: string
    options?: PasswordlessOptions
  }
  | {
    type: 'SIGNIN_PASSWORDLESS_SMS'
    phoneNumber?: string
    options?: PasswordlessOptions
  }
  | { type: 'SIGNIN_PASSWORDLESS_SMS_OTP', phoneNumber?: string, otp?: string }
  | { type: 'SIGNUP_EMAIL_PASSWORD'; email?: string; password?: string; options?: SignUpOptions }
  | { type: 'TOKEN_REFRESH_ERROR'; error: ErrorPayload }
  | { type: 'SIGNOUT'; all?: boolean }
  | { type: 'SIGNIN_MFA_TOTP', ticket?: string, otp?: string }
