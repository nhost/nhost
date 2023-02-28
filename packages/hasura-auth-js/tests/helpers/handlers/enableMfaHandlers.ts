import { faker } from '@faker-js/faker'
import { rest } from 'msw'
import { BASE_URL } from '../config'

/**
 * Request handler for MSW to mock a network error when generating MFA TOTP.
 */
export const generateMfaTotpNetworkErrorHandler = rest.get(
  `${BASE_URL}/mfa/totp/generate`,
  (_req, res) => {
    return res.networkError('Network error')
  }
)

/**
 * Request handler for MSW to mock an an internal server error when generating MFA TOTP.
 */
export const generateMfaTotpInternalErrorHandler = rest.get(
  `${BASE_URL}/mfa/totp/generate`,
  (_req, res, ctx) => {
    return res(
      ctx.status(500),
      ctx.json({ status: 500, error: 'internal-error', message: 'Internal error' })
    )
  }
)

/**
 * Request handler for MSW to mock an error when access token is invalid or not provided when
 * generating MFA TOTP.
 */
export const generateMfaTotpUnauthorizedErrorHandler = rest.get(
  `${BASE_URL}/mfa/totp/generate`,
  (_req, res, ctx) => {
    return res(
      ctx.status(401),
      ctx.json({
        status: 401,
        message: 'User is not logged in',
        error: 'unauthenticated-user'
      })
    )
  }
)

/**
 * Request handler for MSW to mock a successful network request when generating MFA TOTP.
 */
export const generateMfaTotpSuccessHandler = rest.get(
  `${BASE_URL}/mfa/totp/generate`,
  (_req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        imageUrl: faker.image.imageUrl(),
        totpSecret: faker.datatype.uuid()
      })
    )
  }
)

/**
 * Request handler for MSW to mock a network error when activating MFA.
 */
export const activateMfaTotpNetworkErrorHandler = rest.post(`${BASE_URL}/user/mfa`, (_req, res) => {
  return res.networkError('Network error')
})

/**
 * Request handler for MSW to mock an an internal server error when activating MFA.
 */
export const activateMfaTotpInternalErrorHandler = rest.post(
  `${BASE_URL}/user/mfa`,
  (_req, res, ctx) => {
    return res(
      ctx.status(500),
      ctx.json({ status: 500, error: 'internal-error', message: 'Internal error' })
    )
  }
)

/**
 * Request handler for MSW to mock an error when access token is invalid or not provided when
 * activating MFA.
 */
export const activateMfaTotpUnauthorizedErrorHandler = rest.post(
  `${BASE_URL}/user/mfa`,
  (_req, res, ctx) => {
    return res(
      ctx.status(401),
      ctx.json({
        status: 401,
        message: 'User is not logged in',
        error: 'unauthenticated-user'
      })
    )
  }
)

/**
 * Request handler for MSW to mock an successful network request when activating MFA.
 */
export const activateMfaTotpSuccessHandler = rest.post(`${BASE_URL}/user/mfa`, (_req, res, ctx) => {
  return res(ctx.status(200), ctx.json('OK'))
})
