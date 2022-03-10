export const NETWORK_ERROR_CODE = 0
export const VALIDATION_ERROR_CODE = 10

export type ErrorPayload = {
  error: string
  status: number
  message: string
}

export type ValidationErrorPayload = ErrorPayload & { status: typeof VALIDATION_ERROR_CODE }

export const INVALID_EMAIL_ERROR: ValidationErrorPayload = {
  status: VALIDATION_ERROR_CODE,
  error: 'invalid-email',
  message: 'Email is incorrectly formatted'
}

export const INVALID_PASSWORD_ERROR: ValidationErrorPayload = {
  status: VALIDATION_ERROR_CODE,
  error: 'invalid-password',
  message: 'Password is incorrectly formatted'
}

export const NO_MFA_TICKET_ERROR: ValidationErrorPayload = {
  status: VALIDATION_ERROR_CODE,
  error: 'no-mfa-ticket',
  message: 'No MFA ticket has been provided'
}
