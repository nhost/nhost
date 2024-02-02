import type {
  NhostSession,
  PasswordlessOptions,
  SignUpOptions,
  SignUpSecurityKeyOptions
} from '../../types'

export type AuthEvents =
  | { type: 'SESSION_UPDATE'; data: { session: NhostSession } }
  | { type: 'TRY_TOKEN'; token: string }
  | { type: 'SIGNIN_ANONYMOUS' }
  | { type: 'SIGNIN_PAT'; pat: string }
  | { type: 'SIGNIN_SECURITY_KEY_EMAIL'; email?: string }
  | { type: 'SIGNIN_PASSWORD'; email?: string; password?: string }
  | {
      type: 'PASSWORDLESS_EMAIL'
      email?: string
      options?: PasswordlessOptions
    }
  | {
      type: 'PASSWORDLESS_SMS'
      phoneNumber?: string
      options?: PasswordlessOptions
    }
  | { type: 'PASSWORDLESS_SMS_OTP'; phoneNumber?: string; otp?: string }
  | { type: 'SIGNUP_EMAIL_PASSWORD'; email?: string; password?: string; options?: SignUpOptions }
  | { type: 'SIGNUP_SECURITY_KEY'; email?: string; options?: SignUpSecurityKeyOptions }
  | { type: 'SIGNOUT'; all?: boolean }
  | { type: 'SIGNIN_MFA_TOTP'; ticket?: string; otp?: string }
  | { type: 'SIGNED_IN' }
  | { type: 'SIGNED_OUT' }
  | { type: 'TOKEN_CHANGED' }
  | { type: 'AWAIT_EMAIL_VERIFICATION' }
