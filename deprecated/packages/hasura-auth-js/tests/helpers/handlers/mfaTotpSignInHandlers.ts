import { faker } from '@faker-js/faker'
import { rest } from 'msw'
import { Mfa, NhostSession } from '../../../src'
import { BASE_URL } from '../config'
import fakeUser from '../mocks/user'

/**
 * Request handler for MSW to mock a network error when trying to sign in using the MFA TOTP sign in
 * method.
 */
export const mfaTotpNetworkErrorHandler = rest.post(`${BASE_URL}/signin/mfa/totp`, (_req, res) => {
  return res.networkError('Network error')
})

/**
 * Request handler for MSW to mock a successful sign in request when using the MFA TOTP sign in
 * method.
 */
export const correctMfaTotpHandler = rest.post(`${BASE_URL}/signin/mfa/totp`, (_req, res, ctx) => {
  return res(
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
})

/**
 * Request handler for MSW to mock an internal server error when trying to sign in using the MFA
 * TOTP sign in method.
 */
export const mfaTotpInternalErrorHandler = rest.post(
  `${BASE_URL}/signin/mfa/totp`,
  (_req, res, ctx) => {
    return res(
      ctx.status(500),
      ctx.json({ status: 500, error: 'internal-error', message: 'Internal error' })
    )
  }
)

/**
 * Request handler for MSW to mock an internal server error when trying to sign in using the
 * MFA TOTP sign in method.
 */
export const mfaTotpInvalidOtpHandler = rest.post(
  `${BASE_URL}/signin/mfa/totp`,
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
