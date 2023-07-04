import { faker } from '@faker-js/faker'
import { HttpResponse, rest } from 'msw'
import { Mfa, NhostSession } from '../../../src'
import { BASE_URL } from '../config'
import fakeUser from '../mocks/user'

/**
 * Request handler for MSW to mock a successful sign in request using the passwordless email sign in
 * method.
 */
export const correctPasswordlessSmsHandler = rest.post(
  `${BASE_URL}/signin/passwordless/sms`,
  () => new Response('OK', { status: 200 })
)

/**
 * Request handler for MSW to mock a network error when trying to sign in using the passwordless SMS
 * sign in method.
 */
export const passwordlessSmsNetworkErrorHandler = rest.post(
  `${BASE_URL}/signin/passwordless/sms`,
  () => new Response('Network error', { status: 500 })
)

/**
 * Request handler for MSW to mock an internal server error when trying to sign in using the
 * passwordless SMS sign in method.
 */
export const passwordlessSmsInternalErrorHandler = rest.post(
  `${BASE_URL}/signin/passwordless/sms`,
  () =>
    HttpResponse.json(
      {
        status: 500,
        error: 'internal-error',
        message: 'Internal error'
      },
      { status: 500 }
    )
)

/**
 * Request handler for MSW to mock a successful sign in request using the passwordless email sign in
 * method.
 */
export const correctPasswordlessSmsOtpHandler = rest.post(
  `${BASE_URL}/signin/passwordless/sms/otp`,
  () =>
    HttpResponse.json<{
      mfa: Mfa | null
      session: NhostSession | null
    }>({
      session: {
        user: fakeUser,
        accessTokenExpiresIn: 900,
        accessToken: faker.datatype.string(40),
        refreshToken: faker.datatype.uuid()
      },
      mfa: null
    })
)

/**
 * Request handler for MSW to mock an internal server error when trying to sign in using the
 * passwordless SMS OTP sign in method.
 */
export const passwordlessSmsOtpInternalErrorHandler = rest.post(
  `${BASE_URL}/signin/passwordless/sms/otp`,
  () =>
    HttpResponse.json(
      {
        status: 500,
        error: 'internal-error',
        message: 'Internal error'
      },
      { status: 500 }
    )
)

/**
 * Request handler for MSW to mock an internal server error when trying to sign in using the
 * passwordless SMS OTP sign in method.
 */
export const passwordlessSmsOtpInvalidOtpHandler = rest.post(
  `${BASE_URL}/signin/passwordless/sms/otp`,
  () =>
    HttpResponse.json(
      {
        status: 401,
        message: 'Invalid or expired OTP',
        error: 'invalid-otp'
      },
      { status: 401 }
    )
)

/**
 * Request handler for MSW to mock a network error when trying to sign in using the passwordless SMS
 * OTP sign in method.
 */
export const passwordlessSmsOtpNetworkErrorHandler = rest.post(
  `${BASE_URL}/signin/passwordless/sms/otp`,
  () => new Response('Network error', { status: 500 })
)
