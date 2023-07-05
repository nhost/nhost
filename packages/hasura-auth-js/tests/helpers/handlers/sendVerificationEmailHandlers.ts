import { HttpResponse, rest } from 'msw'
import { BASE_URL } from '../config'

/**
 * Request handler for MSW to mock an internal server error when requesting a password reset.
 */
export const sendVerificationEmailInternalErrorHandler = rest.post(
  `${BASE_URL}/user/email/send-verification-email`,
  () => {
    return HttpResponse.json(
      {
        status: 500,
        error: 'internal-error',
        message: 'Internal error'
      },
      { status: 500 }
    )
  }
)

/**
 * Request handler for MSW to mock a network error when requesting a password reset.
 */
export const sendVerificationEmailNetworkErrorHandler = rest.post(
  `${BASE_URL}/user/email/send-verification-email`,
  () => new Response(null, { status: 500, statusText: 'Network erro' })
)

/**
 * Request handler for MSW to mock a bad request when requesting a password reset.
 */
export const sendVerificationEmailInvalidEmailHandler = rest.post(
  `${BASE_URL}/user/email/send-verification-email`,
  () =>
    HttpResponse.json(
      {
        status: 400,
        message: '"email" must be a valid email',
        error: 'invalid-request'
      },
      { status: 400 }
    )
)

/**
 * Request handler for MSW to mock a "User Not Found" error when requesting a password reset.
 */
export const sendVerificationEmailUserNotFoundHandler = rest.post(
  `${BASE_URL}/user/email/send-verification-email`,
  () =>
    HttpResponse.json(
      {
        status: 400,
        message: 'No user found',
        error: 'user-not-found'
      },
      { status: 400 }
    )
)

/**
 * Request handler for MSW to mock a successful network request when requesting a password reset.
 */
export const sendVerificationEmailSuccessHandler = rest.post(
  `${BASE_URL}/user/email/send-verification-email`,
  () => new Response('OK', { status: 200 })
)
