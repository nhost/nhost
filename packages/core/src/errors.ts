export const NETWORK_ERROR_CODE = 0
export const VALIDATION_ERROR_CODE = 10
export const STATE_ERROR_CODE = 20

export type ErrorPayload = {
  error: string
  status: number
  message: string
}

export type ValidationErrorPayload = ErrorPayload & { status: typeof VALIDATION_ERROR_CODE }

// TODO share with hasura-auth
export const INVALID_EMAIL_ERROR: ValidationErrorPayload = {
  status: VALIDATION_ERROR_CODE,
  error: 'invalid-email',
  message: 'Email is incorrectly formatted'
}

export const INVALID_MFA_TYPE_ERROR: ValidationErrorPayload = {
  status: VALIDATION_ERROR_CODE,
  error: 'invalid-mfa-type',
  message: 'MFA type is invalid'
}

export const INVALID_MFA_CODE_ERROR: ValidationErrorPayload = {
  status: VALIDATION_ERROR_CODE,
  error: 'invalid-mfa-code',
  message: 'MFA code is invalid'
}

export const INVALID_PASSWORD_ERROR: ValidationErrorPayload = {
  status: VALIDATION_ERROR_CODE,
  error: 'invalid-password',
  message: 'Password is incorrectly formatted'
}

export const INVALID_PHONE_NUMBER_ERROR: ValidationErrorPayload = {
  status: VALIDATION_ERROR_CODE,
  error: 'invalid-phone-number',
  message: 'Phone number is incorrectly formatted'
}

export const INVALID_MFA_TICKET_ERROR: ValidationErrorPayload = {
  status: VALIDATION_ERROR_CODE,
  error: 'invalid-mfa-ticket',
  message: 'MFA ticket is invalid'
}

export const NO_MFA_TICKET_ERROR: ValidationErrorPayload = {
  status: VALIDATION_ERROR_CODE,
  error: 'no-mfa-ticket',
  message: 'No MFA ticket has been provided'
}

export const NO_REFRESH_TOKEN: ValidationErrorPayload = {
  status: VALIDATION_ERROR_CODE,
  error: 'no-refresh-token',
  message: 'No refresh token has been provided'
}

export const TOKEN_REFRESHER_RUNNING_ERROR: ErrorPayload = {
  status: STATE_ERROR_CODE,
  error: 'refresher-already-running',
  message:
    'The token refresher is already running. You must wait until is has finished before submitting a new token.'
}

export const USER_ALREADY_SIGNED_IN: ErrorPayload = {
  status: STATE_ERROR_CODE,
  error: 'already-signed-in',
  message: 'User is already signed in'
}

export const USER_UNAUTHENTICATED: ErrorPayload = {
  status: STATE_ERROR_CODE,
  error: 'unauthenticated-user',
  message: 'User is not authenticated'
}

export const USER_NOT_ANONYMOUS: ErrorPayload = {
  status: STATE_ERROR_CODE,
  error: 'user-not-anonymous',
  message: 'User is not anonymous'
}

export const EMAIL_NEEDS_VERIFICATION: ErrorPayload = {
  status: STATE_ERROR_CODE,
  error: 'unverified-user',
  message: 'Email needs verification'
}

export const INVALID_AUTHENTICATION_METHOD = {
  status: VALIDATION_ERROR_CODE,
  error: 'invalid-authentication-method',
  message: 'Incorrect parameters'
}

export const INVALID_REFRESH_TOKEN = {
  status: VALIDATION_ERROR_CODE,
  error: 'invalid-refresh-token',
  message: 'Invalid or expired refresh token'
}
