import { faker } from '@faker-js/faker'
import { rest } from 'msw'
import { Mfa, NhostSession } from '../../../src'
import { BASE_URL } from '../config'
import fakeUser from '../mocks/user'

/**
 * Request handler for MSW to mock a successful sign in request using the passwordless email sign in
 * method.
 */
export const correctPasswordlessSmsHandler = rest.post(
  `${BASE_URL}/signin/passwordless/sms`,
  (_req, res, ctx) => {
    return res(ctx.status(200), ctx.json('OK'))
  }
)

/**
 * Request handler for MSW to mock a network error when trying to sign in using the passwordless SMS
 * sign in method.
 */
export const passwordlessSmsNetworkErrorHandler = rest.post(
  `${BASE_URL}/signin/passwordless/sms`,
  (_req, res) => {
    return res.networkError('Network error')
  }
)

/**
 * Request handler for MSW to mock an internal server error when trying to sign in using the
 * passwordless SMS sign in method.
 */
export const passwordlessSmsInternalErrorHandler = rest.post(
  `${BASE_URL}/signin/passwordless/sms`,
  (_req, res, ctx) => {
    return res(
      ctx.status(500),
      ctx.json({ status: 500, error: 'internal-error', message: 'Internal error' })
    )
  }
)

/**
 * Request handler for MSW to mock a successful sign in request using the passwordless email sign in
 * method.
 */
export const correctPasswordlessSmsOtpHandler = rest.post(
  `${BASE_URL}/signin/passwordless/sms/otp`,
  (_req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json<{ mfa: Mfa | null; session: NhostSession | null }>({
        session: {
          user: fakeUser,
          accessTokenExpiresIn: 900,
          accessToken: faker.datatype.string(40),
          refreshToken: faker.datatype.uuid()
        },
        mfa: null
      })
    )
  }
)

/**
 * Request handler for MSW to mock an internal server error when trying to sign in using the
 * passwordless SMS OTP sign in method.
 */
export const passwordlessSmsOtpInternalErrorHandler = rest.post(
  `${BASE_URL}/signin/passwordless/sms/otp`,
  (_req, res, ctx) => {
    return res(
      ctx.status(500),
      ctx.json({ status: 500, error: 'internal-error', message: 'Internal error' })
    )
  }
)

/**
 * Request handler for MSW to mock an internal server error when trying to sign in using the
 * passwordless SMS OTP sign in method.
 */
export const passwordlessSmsOtpInvalidOtpHandler = rest.post(
  `${BASE_URL}/signin/passwordless/sms/otp`,
  (_req, res, ctx) => {
    return res(
      ctx.status(401),
      ctx.json({
        status: 401,
        message: 'Invalid or expired OTP',
        error: 'invalid-otp'
      })
    )
  }
)

/**
 * Request handler for MSW to mock a network error when trying to sign in using the passwordless SMS
 * OTP sign in method.
 */
export const passwordlessSmsOtpNetworkErrorHandler = rest.post(
  `${BASE_URL}/signin/passwordless/sms/otp`,
  (_req, res) => {
    return res.networkError('Network error')
  }
)
