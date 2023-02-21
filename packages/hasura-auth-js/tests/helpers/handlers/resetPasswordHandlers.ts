import { rest } from 'msw'
import { BASE_URL } from '../config'

/**
 * Request handler for MSW to mock an internal server error when requesting a password reset.
 */
export const resetPasswordInternalErrorHandler = rest.post(
  `${BASE_URL}/user/password/reset`,
  (_req, res, ctx) => {
    return res(
      ctx.status(500),
      ctx.json({ status: 500, error: 'internal-error', message: 'Internal error' })
    )
  }
)

/**
 * Request handler for MSW to mock a network error when requesting a password reset.
 */
export const resetPasswordNetworkErrorHandler = rest.post(
  `${BASE_URL}/user/password/reset`,
  (_req, res) => {
    return res.networkError('Network error')
  }
)

/**
 * Request handler for MSW to mock a bad request when requesting a password reset.
 */
export const resetPasswordInvalidEmailHandler = rest.post(
  `${BASE_URL}/user/password/reset`,
  (_req, res, ctx) => {
    return res(
      ctx.status(400),
      ctx.json({
        status: 400,
        message: '"email" must be a valid email',
        error: 'invalid-request'
      })
    )
  }
)

/**
 * Request handler for MSW to mock a "User Not Found" error when requesting a password reset.
 */
export const resetPasswordUserNotFoundHandler = rest.post(
  `${BASE_URL}/user/password/reset`,
  (_req, res, ctx) => {
    return res(
      ctx.status(400),
      ctx.json({
        status: 400,
        message: 'No user found',
        error: 'user-not-found'
      })
    )
  }
)

/**
 * Request handler for MSW to mock a successful network request when requesting a password reset.
 */
export const resetPasswordSuccessHandler = rest.post(
  `${BASE_URL}/user/password/reset`,
  (_req, res, ctx) => {
    return res(ctx.status(200), ctx.json('OK'))
  }
)
