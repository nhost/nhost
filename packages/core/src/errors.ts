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
  message: 'Incorrectly formatted email'
}

export const INVALID_PASSWORD_ERROR: ValidationErrorPayload = {
  status: VALIDATION_ERROR_CODE,
  error: 'invalid-password',
  message: 'Incorrect password'
}
