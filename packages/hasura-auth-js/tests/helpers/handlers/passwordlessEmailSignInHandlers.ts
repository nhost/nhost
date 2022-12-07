import { rest } from 'msw'
import { BASE_URL } from '../config'

/**
 * Request handler for MSW to mock a successful sign in request using the passwordless email sign in
 * method.
 */
export const correctPasswordlessEmailHandler = rest.post(
  `${BASE_URL}/signin/passwordless/email`,
  (_req, res, ctx) => {
    return res(ctx.status(200), ctx.json('OK'))
  }
)

/**
 * Request handler for MSW to mock a network error when trying to sign in using the passwordless
 * email sign in method.
 */
export const passwordlessEmailNetworkErrorHandler = rest.post(
  `${BASE_URL}/signin/passwordless/email`,
  (_req, res) => {
    return res.networkError('Network error')
  }
)

/**
 * Request handler for MSW to mock an internal server error when trying to sign in using the
 * passwordless email sign in method.
 */
export const passwordlessEmailInternalErrorHandler = rest.post(
  `${BASE_URL}/signin/passwordless/email`,
  (_req, res, ctx) => {
    return res(
      ctx.status(500),
      ctx.json({ status: 500, error: 'internal-error', message: 'Internal error' })
    )
  }
)
