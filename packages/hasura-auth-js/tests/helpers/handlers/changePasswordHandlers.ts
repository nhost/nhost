import { rest } from 'msw'
import { BASE_URL } from '../config'

/**
 * Request handler for MSW to mock a network error when changing password address.
 */
export const changePasswordNetworkErrorHandler = rest.post(
  `${BASE_URL}/user/password`,
  (_req, res) => {
    return res.networkError('Network error')
  }
)

/**
 * Request handler for MSW to mock an an internal server error when changing password address.
 */
export const changePasswordInternalErrorHandler = rest.post(
  `${BASE_URL}/user/password`,
  (_req, res, ctx) => {
    return res(
      ctx.status(500),
      ctx.json({ status: 500, error: 'internal-error', message: 'Internal error' })
    )
  }
)

/**
 * Request handler for MSW to mock an error when access token is invalid or not provided when
 * changing password address.
 */
export const changePasswordUnauthorizedErrorHandler = rest.post(
  `${BASE_URL}/user/password`,
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
 * Request handler for MSW to mock a successful network request when changing password address.
 */
export const changePasswordSuccessHandler = rest.post(
  `${BASE_URL}/user/password`,
  (_req, res, ctx) => {
    return res(ctx.status(200), ctx.json('OK'))
  }
)
