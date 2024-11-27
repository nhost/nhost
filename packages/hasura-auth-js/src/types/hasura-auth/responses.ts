import { AuthErrorPayload, NhostSession } from './common'

// Hasura-auth API response types
export interface NullableErrorResponse {
  error: AuthErrorPayload | null
}

/** session payload from common hasura-auth responses */
export type NhostSessionResponse =
  | { session: null; error: AuthErrorPayload }
  | { session: NhostSession | null; error: null }

/** payload from hasura-auth endpoint /signin/email-password */
export interface SignInResponse {
  session: NhostSession | null
  mfa: {
    ticket: string
  } | null
  error: AuthErrorPayload | null
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

/** payload from hasura-auth endpoint /signin/pat */
export type SignInPATResponse = NhostSessionResponse

/** payload from hasura-auth endpoint /signin/anonymous */
export type PasswordlessSmsOtpResponse = NhostSessionResponse

/** payload from hasura-auth endpoint /signin/otp/email */
export interface SignInEmailOTPResponse extends NullableErrorResponse {}

/** payload from hasura-auth endpoint /signin/otp/email/verify */
export type VerifyEmailOTPResponse = NhostSessionResponse

/** payload from hasura-auth endpoint /signin/mfa/totp */
export type SignInMfaTotpResponse = NhostSessionResponse

export type ConnectProviderResponse = { providerUrl?: string }
